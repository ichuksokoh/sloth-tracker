import type { Tags, TagTracker } from "@/types";

export function updateAllTags(
  allTags: Record<string, TagTracker>,
  tagsToAdd: Tags[],
  change: number = 1,
  isCustomUpdate: boolean = false
) {
  for (const tag of tagsToAdd) {
    if (allTags[tag.tagName]) {
      if (tag.isCustom) {
        allTags[tag.tagName].custom = true;
      }
      allTags[tag.tagName].count += change;
      // only increment ogCount if changeType is not custom
      allTags[tag.tagName].ogCount += !isCustomUpdate ? change : 0;
    } else {
      allTags[tag.tagName] = {
        count: change,
        active: false,
        custom: tag.isCustom,
        ogCount: !isCustomUpdate ? change : 1
      };
    }
  }
  const tags = Object.keys(allTags);
  // Even if we add a tag for a negative incrrement, we still remove it since count < 0 so no issue there
  for (const tagName of tags) {
    if (allTags[tagName].ogCount <= 0 || (allTags[tagName].count <= 0 && allTags[tagName].custom)) {
      delete allTags[tagName];
    }
  }
}

export async function setTagActive(tag: string, active: boolean) {
  await chrome.runtime.sendMessage({ type: "tag:setActive", tag, active });
}

export async function clearAllActiveTags() {
  await chrome.runtime.sendMessage({ type: "tag:clearActive" });
}

export async function setHiddenTagActive(tag: string, active: boolean) {
  await chrome.runtime.sendMessage({ type: "hiddentag:setActive", tag, active });
}

export async function clearAllHiddenActiveTags() {
  await chrome.runtime.sendMessage({ type: "hiddentag:clearActive" });
}
