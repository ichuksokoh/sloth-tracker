import type { Tags, TagTracker } from "@/types";

export function updateAllTags(
  allTags: Record<string, TagTracker>,
  tagsToModify: Tags[],
  change: number = 1,
  isCustomUpdate: boolean = false
) {
  for (const tag of tagsToModify) {
    if (allTags[tag.tagName]) {
      allTags[tag.tagName].custom = tag.isCustom;

      if (change === 0) {
        // hidden value is switched if change is 0
        allTags[tag.tagName].count += !tag.hidden ? 1 : -1;
        allTags[tag.tagName].hiddenCount += tag.hidden ? 1 : -1;
      } else if (tag.hidden) {
        allTags[tag.tagName].hiddenCount += change;
      } else {
        allTags[tag.tagName].count += change;
      }

      // only increment ogCount if changeType is not custom
      // if it's a hidden update change is 0 anyway
      allTags[tag.tagName].ogCount += !isCustomUpdate ? change : 0;
    } else {
      allTags[tag.tagName] = {
        count: !tag.hidden ? change : 0,
        active: false,
        custom: tag.isCustom,
        ogCount: !isCustomUpdate ? change : 1,
        hiddenCount: tag.hidden ? change : 0,
      };
    }
  }
  const tags = Object.keys(allTags);
  // Even if we add a tag for a negative incrrement, we still remove it since count < 0 so no issue there
  for (const tagName of tags) {
    if (
      allTags[tagName].ogCount <= 0 ||
      ((allTags[tagName].count <= 0 && allTags[tagName].hiddenCount <= 0) && allTags[tagName].custom)
    ) {
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

