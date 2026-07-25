import { withLock } from "./asyncMutex";
import type { Manhwa, ScrapedChapter, ScrapedManhwa } from "@/types";
import { deleteCachedCover, cacheCover } from "./coverCache.svelte";
import { stringSimilarity } from "./titleMatch";
import { fetchMangaTags } from "@/background/services/anilist";
import { fetchMangadexCover } from "@/background/services/mangadex";

const MANHWA_KEY = "manhwaList";
const RECENTLY_DELETED_KEY = "recentlyDeletedManhwa";
const RECENTLY_DELETED_RETENTION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const Excludetags = ["Wuxia", "Long Strip", "Full Color", "Male Protagonist", "Female Protagonist"];

async function readManhwaList(): Promise<Manhwa[]> {
  const res = await chrome.storage.local.get({ [MANHWA_KEY]: [] });
  const stored = res[MANHWA_KEY];
  return Array.isArray(stored) ? stored : [];
}

async function writeManhwaList(list: Manhwa[]) {
  await chrome.storage.local.set({ [MANHWA_KEY]: list });
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
    currentChapter: scraped.chapters.length > 0 ? scraped.chapters[0].number : 0,
    totalChapters: scraped.totalChapters ?? undefined,
    chapters: scraped.chapters,
    tags: [],
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
      console.error("[background] failed to cache cover for", manhwa.title, err);
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
      manhwa.tags = aniListMedia.genres;
    }
    if (aniListMedia?.tags) {
      const excludedTags = Excludetags.map((tag) => tag.toLowerCase().replace('-', ' '));
      const filteredTags = aniListMedia.tags
        .filter((tag) => 
          !excludedTags.includes(tag.name.toLowerCase().replace('-', ' ')) &&
          !tag.isAdult && !tag.isMediaSpoiler).map((tag) => tag.name);
      manhwa.tags = [...new Set([...manhwa.tags, ...filteredTags])];
      manhwa.tags.sort((a, b) => a.localeCompare(b));
    }
  } catch (err) {
    console.error("[background] failed to fetch AniList tags for", manhwa.title, err);
  }

  return manhwa;
}

export function addManhwa(manhwa: ScrapedManhwa) {
  return withLock(async () => {
    const list = await readManhwaList();
    const revivable = await reviveManhwa(manhwa);
    if (revivable) {
      console.log("[background] reviving manhwa from recently deleted:", manhwa.title);
      list.push(revivable);
    } else {
      console.log("[background] creating new manhwa from scraped data:", manhwa.title);
      const newBornManhwa = await createManhwaFromScraped(manhwa);
      list.push(newBornManhwa);
    }
    // list.push(manhwa);
    await writeManhwaList(list);
  });
}

export function updateManhwa(id: string, patch: Partial<Manhwa>) {
  return withLock(async () => {
    const list = await readManhwaList();
    const next = list.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m));
    await writeManhwaList(next);
  });
}

export function removeManhwa(id: string) {
  return withLock(async () => {
    const list = await readManhwaList();
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
    }
  });
}

export function clearManhwa() {
  return withLock(() => writeManhwaList([]));
}
