import type { Manhwa, ScrapedManhwa, TagTracker } from "@/types";
import { stringSimilarity } from "./titleMatch";

let list = $state<Manhwa[]>([]);
let allTags = $state<Record<string,TagTracker>>({}); 
let hiddenTags = $state<Record<string,TagTracker>>({});

// hydrate on load
chrome.storage.local.get<{ manhwaList: Manhwa[] }>({ manhwaList: [] }).then((res) => {
  const stored = res.manhwaList;
  list = Array.isArray(stored) ? stored : [];
});

chrome.storage.local.get<{ allTags: Record<string, TagTracker>}>({ allTags: {} }).then((res) => {
  const stored = res.allTags
  allTags = stored && typeof stored === 'object' ? stored : {}
})

chrome.storage.local.get<{ hiddenTags: Record<string, TagTracker>}>({ hiddenTags: {} }).then((res) => {
  const stored = res.hiddenTags
  hiddenTags = stored && typeof stored === 'object' ? stored : {}
})

// stay in sync when ANY context (popup/sidepanel/content) changes it
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.manhwaList) {
    const val = changes.manhwaList.newValue;
    list = Array.isArray(val) ? (val as Manhwa[]) : [];
  }
  if (area === "local" && changes.allTags) {
    const val = changes.allTags.newValue;
      allTags = val && typeof val === 'object' ? val as Record<string,TagTracker> : {} 
  }
  if (area === "local" && changes.hiddenTags) {
    const val = changes.hiddenTags.newValue;
    hiddenTags = val && typeof val === 'object' ? val as Record<string,TagTracker> : {} 
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
    await chrome.runtime.sendMessage({ type: "manhwa:add", manhwa: item });
  },
  async update(id: string, patch: Partial<Manhwa>) {
    await chrome.runtime.sendMessage({ type: "manhwa:update", id, manhwa: patch });
  },
  async remove(id: string) {
    await chrome.runtime.sendMessage({ type: "manhwa:remove", id });
  },
  async getById(id: string) {
    return list.find((m) => m.id === id);
  },
  async getManhwaBySourceUrl(url: string) {
    return list.find((m) => m.sourceUrl === url);
  },
  async clear() {
    await chrome.runtime.sendMessage({ type: "manhwa:clear" });
  },
  async getManhwaByTitleOnHost(title: string, url: string, threshold = 0.9) {
    const host = getHostname(url);
    if (!host) return undefined;

    let best: { manhwa: Manhwa; score: number } | undefined;
    for (const m of list) {
      if (getHostname(m.sourceUrl) !== host) continue;
      const score = stringSimilarity(title, m.title);
      if (score >= threshold && (!best || score > best.score)) {
        best = { manhwa: m, score };
      }
    }
    return best?.manhwa;
  }
};
