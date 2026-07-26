import type { TagTracker } from "@/types";

export function updateAllTags(allTags: Record<string, TagTracker>, tagsToAdd: string[], change: number = 1) {
  for (const tag of tagsToAdd) {
    if (allTags[tag]) {
      allTags[tag].count += change;
    } else {
      allTags[tag] = { count: change, active: false };
    }
  }
  const tags = Object.keys(allTags);
  for (const tag of tags) {
    if (allTags[tag].count <= 0) {
      delete allTags[tag];
    }
  }
}

export async function setTagActive(tag: string, active: boolean) {
  await chrome.runtime.sendMessage({ type: "tag:setActive", tag, active });
}

export async function clearAllActiveTags() {
  await chrome.runtime.sendMessage({ type: "tag:clearActive" });
}