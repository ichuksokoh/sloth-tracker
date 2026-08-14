import {
  ManhwaSchema,
  type ImportOptions,
  type Manhwa,
  type ManhwaExport,
  type ScrapedManhwa,
  type TagTracker
} from "@/types";
import { stringSimilarity } from "./titleMatch";
import { untrack } from "svelte";
import { z } from "zod";

let list = $state<Manhwa[]>([]);
let allTags = $state<Record<string, TagTracker>>({});
let hiddenTags = $state<Record<string, TagTracker>>({});

// hydrate on load
chrome.storage.local.get<{ manhwaList: Manhwa[] }>({ manhwaList: [] }).then((res) => {
  const stored = res.manhwaList;
  list = Array.isArray(stored) ? stored : [];
});

chrome.storage.local.get<{ allTags: Record<string, TagTracker> }>({ allTags: {} }).then((res) => {
  const stored = res.allTags;
  allTags = stored && typeof stored === "object" ? stored : {};
});

chrome.storage.local.get<{ hiddenTags: Record<string, TagTracker> }>({ hiddenTags: {} }).then((res) => {
  const stored = res.hiddenTags;
  hiddenTags = stored && typeof stored === "object" ? stored : {};
});

function reconcileList(oldList: Manhwa[], newList: Manhwa[]): Manhwa[] {
  const oldById = new Map(oldList.map((m) => [m.id, m]));
  return newList.map((next) => {
    const prev = oldById.get(next.id);
    return prev && prev.updatedAt === next.updatedAt ? prev : next;
  });
}

function reconcileTagRecord(
  oldTags: Record<string, TagTracker>,
  newTags: Record<string, TagTracker>
): Record<string, TagTracker> {
  const result: Record<string, TagTracker> = {};
  for (const key in newTags) {
    const prev = oldTags[key];
    const next = newTags[key];
    const nextKeys = Object.keys(next) as (keyof TagTracker)[];
    result[key] = prev && nextKeys.every((k) => prev[k] === next[k]) ? prev : next;
  }
  return result;
}

const ManhwaListSchema = z.array(ManhwaSchema);
// stay in sync when ANY context (popup/sidepanel/content) changes it
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.manhwaList) {
    const val = changes.manhwaList.newValue;
    const parsed = ManhwaListSchema.safeParse(val);
    if (!parsed.success) {
      console.error("[manhwaStore] corrupted manhwaList from storage", parsed.error);
      return; // keep the last known-good `list` instead of wiping the UI
    }
    list = reconcileList(list, parsed.data);
  }
  if (area === "local" && changes.allTags) {
    const val = changes.allTags.newValue;
    const incoming = val && typeof val === "object" ? (val as Record<string, TagTracker>) : {};
    allTags = reconcileTagRecord(allTags, incoming);
  }
});

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const manhwaStore = {
  get list() {
    return list;
  },
  get allTags() {
    return allTags;
  },
  get hiddenTags() {
    return hiddenTags;
  },
  async add(item: ScrapedManhwa) {
    console.log("[content] adding new manhwa:", item.title);
    const response = await chrome.runtime.sendMessage({ type: "manhwa:add", manhwa: item });
    return response?.manhwa as Manhwa | undefined;
  },
  async update(id: string, patch: Partial<Manhwa>, customUpdate: boolean = false) {
    await chrome.runtime.sendMessage({ type: "manhwa:update", id, manhwa: patch, customUpdate });
  },
  async remove(id: string) {
    await chrome.runtime.sendMessage({ type: "manhwa:remove", id });
  },
  async clear() {
    await chrome.runtime.sendMessage({ type: "manhwa:clear" });
  },
  // Plain point-in-time lookups — wrapped in untrack so calling these from
  // inside a $effect never accidentally subscribes that effect to `list`.
  // Without this, any effect that both reads one of these AND (directly or
  // indirectly, e.g. via manhwaStore.update) writes to `list` creates a
  // self-triggering loop.
  getById(id: string) {
    return untrack(() => list.find((m) => m.id === id));
  },
  getManhwaBySourceUrl(url: string) {
    return untrack(() => list.find((m) => m.sourceUrl === url));
  },
  getManhwaByTitleOnHost(title: string, url: string, threshold = 0.9) {
    const host = getHostname(url);
    if (!host) return undefined;
    return untrack(() => {
      let best: { manhwa: Manhwa; score: number } | undefined;
      for (const m of list) {
        if (getHostname(m.sourceUrl) !== host) continue;
        const score = stringSimilarity(title, m.title);
        if (score >= threshold && (!best || score > best.score)) {
          best = { manhwa: m, score };
        }
      }
      return best?.manhwa;
    });
  }
};
