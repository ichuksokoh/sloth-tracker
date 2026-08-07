import { withLock } from "./asyncMutex";
import type { Manhwa, ScrapedChapter, ScrapedManhwa, TagTracker } from "@/types";
import { deleteCachedCover, cacheCover } from "./coverCache.svelte";
import { stringSimilarity } from "./titleMatch";
import { fetchMangaTags } from "@/background/services/anilist";
import { fetchMangadexCover } from "@/background/services/mangadex";
import * as tagManager from "./tagManager";
import { fetchKitsuByTitleMatched } from "@/background/services/kitsu";

const MANHWA_KEY = "manhwaList";
const ALL_TAGS_KEY = "allTags";
const HIDDEN_TAGS_KEY = "hiddenTags";
const RECENTLY_DELETED_KEY = "recentlyDeletedManhwa";
const RECENTLY_DELETED_RETENTION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const Excludetags = [
  "Wuxia",
  "Long Strip",
  "Full Color",
  "Male Protagonist",
  "Female Protagonist",
  "Nudity",
  "Heterosexual"
];

async function readManhwaList(): Promise<Manhwa[]> {
  const res = await chrome.storage.local.get({ [MANHWA_KEY]: [] });
  const stored = res[MANHWA_KEY];
  return Array.isArray(stored) ? stored : [];
}

async function readAllTags(): Promise<Record<string, TagTracker>> {
  const res = await chrome.storage.local.get({ [ALL_TAGS_KEY]: {} });
  const stored = res[ALL_TAGS_KEY];
  return stored && typeof stored === "object" ? (stored as Record<string, TagTracker>) : {};
}

async function readHiddenTags(): Promise<Record<string, TagTracker>> {
  const res = await chrome.storage.local.get({ [HIDDEN_TAGS_KEY]: {} });
  const stored = res[HIDDEN_TAGS_KEY];
  return stored && typeof stored === "object" ? (stored as Record<string, TagTracker>) : {};
}

async function writeManhwaList(list: Manhwa[]) {
  await chrome.storage.local.set({ [MANHWA_KEY]: list });
}

async function writeAllTags(allTags: Record<string, TagTracker>) {
  await chrome.storage.local.set({ [ALL_TAGS_KEY]: allTags });
}

async function writeHiddenTags(hiddenTags: Record<string, TagTracker>) {
  await chrome.storage.local.set({ [HIDDEN_TAGS_KEY]: hiddenTags });
}

async function readRecentlyDeleted(): Promise<(Manhwa & { __deletedAt: number })[]> {
  const res = await chrome.storage.local.get({ [RECENTLY_DELETED_KEY]: [] });
  const stored = res[RECENTLY_DELETED_KEY];
  return Array.isArray(stored) ? stored : [];
}

async function writeRecentlyDeleted(list: (Manhwa & { __deletedAt: number })[]) {
  await chrome.storage.local.set({ [RECENTLY_DELETED_KEY]: list });
}

// Revive Manhwas from the dead
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function reviveManhwa(scraped: ScrapedManhwa): Promise<Manhwa | null> {
  const threshold = 0.9;
  const deletedList = await readRecentlyDeleted();
  // First attempt at reviving by sourceUrl and title
  const match = deletedList.find((m) => m.sourceUrl === scraped.sourceUrl && m.title === scraped.title);
  const host = getHostname(scraped.sourceUrl ?? "");
  const cmpfn = (a: Manhwa, b: ScrapedManhwa) =>
    stringSimilarity(a.title, b.title) >= threshold && getHostname(a.sourceUrl) === host;
  const hostMatch = deletedList.find((m) => cmpfn(m, scraped));
  const finalMatch = match || hostMatch;
  if (finalMatch) {
    let revivedChps = finalMatch.chapters;
    const chpCompare = (a: ScrapedChapter, b: ScrapedChapter) =>
      a.number === b.number && a.url === b.url && a.label === b.label;
    const hasNewChps = scraped.chapters.length > finalMatch.chapters.length;
    const NewChpsContainOld = finalMatch.chapters.every((ch, i) => chpCompare(ch, scraped.chapters[i]));
    let onlyNewChps = true;
    for (let i = finalMatch.chapters.length; i < scraped.chapters.length; i++) {
      if (finalMatch.chapters.find((ch) => chpCompare(ch, scraped.chapters[i]))) {
        onlyNewChps = false;
        break;
      }
    }
    if (hasNewChps && NewChpsContainOld && onlyNewChps) {
      revivedChps = [...finalMatch.chapters, ...scraped.chapters.slice(finalMatch.chapters.length)];
    }
    const latestChpater =
      scraped.totalChapters === revivedChps.length ? scraped.totalChapters : revivedChps.length;
    const partiallyRestored = {
      ...finalMatch,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chapters: revivedChps,
      totalChapters: latestChpater
    };

    const { __deletedAt, ...fullyRestored } = partiallyRestored;

    // Remove from receently deleted list
    const pruned = deletedList.filter((m) => m.id !== finalMatch.id);
    await writeRecentlyDeleted(pruned);

    return fullyRestored;
  }
  return null;
}

async function createManhwaFromScraped(scraped: ScrapedManhwa): Promise<Manhwa> {
  const manhwa: Manhwa = {
    id: crypto.randomUUID(),
    title: scraped.title,
    sourceUrl: scraped.sourceUrl,
    coverUrl: scraped.coverUrl ?? undefined,
    description: scraped.description ?? undefined,
    status: "Plan To Read",
    favorite: false,
    hidden: false,
    currentChapter: scraped.chapters.length > 0 ? scraped.chapters[0].number : 0,
    totalChapters: scraped.totalChapters,
    chapters: scraped.chapters,
    tags: [],
    ogTags: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (manhwa.coverUrl) {
    try {
      const res = await fetch(manhwa.coverUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      await cacheCover(manhwa.id, blob);
    } catch (err) {
      console.warn("[background] no cover found for", manhwa.title);
      console.log("[background] attempting to fetch fallback cover from MangaDex for", manhwa.title);
      const fallbackBlob = await fetchMangadexCover(manhwa.title);
      if (fallbackBlob) {
        await cacheCover(manhwa.id, fallbackBlob);
      } else {
        console.warn("[background] no fallback cover found for", manhwa.title);
      }
    }
  }

  try {
    const aniListMedia = await fetchMangaTags(manhwa.title);
    console.log("[background] fetched AniList tags for", manhwa.title, aniListMedia);
    if (aniListMedia?.genres) {
      manhwa.tags = aniListMedia.genres.map((genre) => {
        return { tagName: genre, isCustom: false, hidden: false };
      });
      manhwa.ogTags = structuredClone(manhwa.tags); // Store original tags for reference
    }
    if (aniListMedia?.tags) {
      const excludedTags = Excludetags.map((tag) => tag.toLowerCase().replace("-", " "));
      const filteredTags = aniListMedia.tags
        .filter(
          (tag) =>
            !excludedTags.includes(tag.name.toLowerCase().replace("-", " ")) && !tag.isAdult && !tag.isMediaSpoiler
        )
        .map((tag) => {
          return { tagName: tag.name, isCustom: false, hidden: false };
        });
      manhwa.tags = [...new Set([...manhwa.tags, ...filteredTags])];
      manhwa.tags.sort((a, b) => a.tagName.localeCompare(b.tagName));
      manhwa.ogTags = structuredClone(manhwa.tags); // Store original tags for reference
    }
    if (aniListMedia?.description) {
      const newDescription = aniListMedia.description.replace(/<br\s*\/?>|\(\s*source.*?\)/gi, "").trim();
      manhwa.description = newDescription.length > 0 ? newDescription : manhwa.description;
    }
  } catch (err) {
    console.error("[background] failed to fetch AniList tags for", manhwa.title, err);
    // Purely for if Anilist goes down, we can still try Kitsu as a fallback
    try {
      const kitsuMedia = await fetchKitsuByTitleMatched(manhwa.title, stringSimilarity);
      console.log("[background] fetched Kitsu tags for", manhwa.title, kitsuMedia);
      if (kitsuMedia?.genres) {
        manhwa.tags = kitsuMedia.genres.map((genre) => {
          return { tagName: genre, isCustom: false, hidden: false };
        });
        manhwa.ogTags = structuredClone(manhwa.tags); // Store original tags for reference
      }
      if (kitsuMedia?.description) {
        const newDescription = kitsuMedia.description.replace(/<br\s*\/?>|\(\s*source.*?\)/gi, "").trim();
        manhwa.description = newDescription.length > 0 ? newDescription : manhwa.description;
      }
    } catch (err) {
      console.error("[background] failed to fetch Kitsu tags for", manhwa.title, err);
    }
  }

  return manhwa;
}

export function addManhwa(manhwa: ScrapedManhwa) {
  return withLock(async () => {
    const list = await readManhwaList();
    const allTags = await readAllTags();
    const revivable = await reviveManhwa(manhwa);

    let finalLiveManhwa: Manhwa;
    if (revivable) {
      console.log("[background] reviving manhwa from recently deleted:", manhwa.title);
      finalLiveManhwa = revivable;
    } else {
      console.log("[background] creating new manhwa from scraped data:", manhwa.title);
      const newBornManhwa = await createManhwaFromScraped(manhwa);
      finalLiveManhwa = newBornManhwa;
    }

    list.push(finalLiveManhwa);
    tagManager.updateAllTags(allTags, finalLiveManhwa.tags);
    await writeAllTags(allTags);
    await writeManhwaList(list);

    return finalLiveManhwa;
  });
}

export function updateManhwa(id: string, patch: Partial<Manhwa>, customUpdate: boolean = false) {
  return withLock(async () => {
    const list = await readManhwaList();
    const oldManhwa = list.find((m) => m.id === id);
    if (!oldManhwa) return;

    const patchedManhwa: Manhwa = { ...oldManhwa, ...patch, updatedAt: Date.now() };
    const oldHidden = oldManhwa.hidden;
    const newHidden = patchedManhwa.hidden;
    const hiddenChanged = oldHidden !== newHidden;

    if (hiddenChanged || patch.tags) {
      const allTags = await readAllTags();
      const oldTags = oldManhwa.tags ?? [];
      const newTags = patchedManhwa.tags ?? [];

      const tagsAdded = newTags.filter((t) => !oldTags.some((o) => o.tagName === t.tagName));
      const tagsRemoved = oldTags.filter((t) => !newTags.some((n) => n.tagName === t.tagName));
      const tagsKept = newTags.filter((t) => oldTags.some((o) => o.tagName === t.tagName));

      // Tags leaving the manga: account for them at whatever hidden state they exited at
      if (tagsRemoved.length) {
        const normalizedRemoved = tagsRemoved.map((t) => ({ ...t, hidden: oldHidden }));
        tagManager.updateAllTags(allTags, normalizedRemoved, -1, customUpdate);
      }

      // Tags joining the manga: account for them at the manga's final hidden state
      if (tagsAdded.length) {
        const normalizedAdded = tagsAdded.map((t) => ({ ...t, hidden: newHidden }));
        tagManager.updateAllTags(allTags, normalizedAdded, 1, customUpdate);
      }

      // Tags that persist: only move them between count/hiddenCount if hidden actually flipped
      if (hiddenChanged && tagsKept.length) {
        const normalizedKept = tagsKept.map((t) => ({ ...t, hidden: newHidden }));
        tagManager.updateAllTags(allTags, normalizedKept, 0, customUpdate);
      }

      await writeAllTags(allTags);

      // Normalize the stored tag list so every tag's `hidden` matches the manga's hidden state
      patchedManhwa.tags = newTags.map((t) => ({ ...t, hidden: newHidden }));
    }

    const next = list.map((m) => (m.id === id ? patchedManhwa : m));
    await writeManhwaList(next);
  });
}

export function removeManhwa(id: string) {
  return withLock(async () => {
    const list = await readManhwaList();
    const allTags = await readAllTags();
    const hiddenTags = await readHiddenTags();
    const removed = list.find((m) => m.id === id);
    const next = list.filter((m) => m.id !== id);
    await writeManhwaList(next);

    if (removed) {
      const deletedList = await readRecentlyDeleted();
      const now = Date.now();
      const toBeDeleted = deletedList.filter((m) => now - m.__deletedAt >= RECENTLY_DELETED_RETENTION_MS);
      for (const m of toBeDeleted) {
        await deleteCachedCover(m.id);
      }
      const pruned = deletedList.filter((m) => now - m.__deletedAt < RECENTLY_DELETED_RETENTION_MS);
      pruned.push({ ...removed, __deletedAt: now });
      await writeRecentlyDeleted(pruned);
      tagManager.updateAllTags(allTags, removed.tags, -1);
      tagManager.updateAllTags(hiddenTags, removed.tags, -1);
      await writeAllTags(allTags);
      await writeHiddenTags(hiddenTags);
    }
  });
}

export function clearManhwa() {
  return withLock(async () => {
    const list = await readManhwaList();
    const allTags = await readAllTags();
    const hiddenTags = await readHiddenTags();
    const deletedList = await readRecentlyDeleted();
    for (const m of list) {
      await deleteCachedCover(m.id);
      tagManager.updateAllTags(allTags, m.tags, -1);
      tagManager.updateAllTags(hiddenTags, m.tags, -1);
      deletedList.push({ ...m, __deletedAt: Date.now() });
    }
    const pruned = deletedList.filter((m) => Date.now() - m.__deletedAt < RECENTLY_DELETED_RETENTION_MS);
    await writeAllTags(allTags);
    await writeHiddenTags(hiddenTags);
    await writeManhwaList([]);
    await writeRecentlyDeleted(pruned);
  });
}

export function setTagActive(tag: string, active: boolean) {
  return withLock(async () => {
    const allTags = await readAllTags();
    if (allTags[tag]) {
      allTags[tag].active = active;
      await writeAllTags(allTags);
    }
  });
}

export function setHiddenTagActive(tag: string, active: boolean) {
  return withLock(async () => {
    const hiddenTags = await readHiddenTags();
    if (hiddenTags[tag]) {
      hiddenTags[tag].active = active;
      await writeHiddenTags(hiddenTags);
    }
  });
}

export function clearAllActiveTags() {
  return withLock(async () => {
    const allTags = await readAllTags();
    for (const tag in allTags) {
      allTags[tag].active = false;
    }
    await writeAllTags(allTags);
  });
}

export function clearAllHiddenActiveTags() {
  return withLock(async () => {
    const hiddenTags = await readHiddenTags();
    for (const tag in hiddenTags) {
      hiddenTags[tag].active = false;
    }
    await writeHiddenTags(hiddenTags);
  });
}
