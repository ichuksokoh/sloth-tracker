<script lang="ts">
  import TagModifier from "./TagModifier.svelte";
  import Tag from "./Tag.svelte";
  import InfoBox from "./PopupBoxes/InfoBox.svelte";
  import type { Tags } from "@/types";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import { cubicOut } from "svelte/easing";
  import type { Manhwa } from "@/types";
  import { fade } from "svelte/transition";
  import { tick } from "svelte";

  interface EditTagsProps {
    manhwa: Manhwa;
  }

  let { manhwa }: EditTagsProps = $props();

  const defaultTags = $derived(
    Object.keys(manhwaStore.allTags).filter((tagName) => !manhwaStore.allTags[tagName].custom)
  );

  const customTags = $derived(
    Object.keys(manhwaStore.allTags).filter((tagName) => manhwaStore.allTags[tagName].custom)
  );

  let customTagsToAdd = $state<Tags[]>([]);
  let defaultTagsToAdd = $state<Tags[]>([]);

  let tagsToBeRemoved = $state<Tags[]>([]); // for preexisting tags that are being removed

  let customTagInput = $state("");
  let customTagInputRef = $state<HTMLInputElement | null>(null);

  let showInfoBox = $state(false);

  let addATag = $state(false);

  $effect(() => {
    console.log("Tags to be removed:", $state.snapshot(tagsToBeRemoved));
    console.log("Custom tags to add:", $state.snapshot(customTagsToAdd));
    console.log("Default tags to add:", $state.snapshot(defaultTagsToAdd));
  });

  // Function to determine if a tag is removable (i.e., not already marked for removal or addition)
  const removable = (tag: Tags) => {
    const inRemoved = tagsToBeRemoved.find((t) => t.tagName === tag.tagName);
    const inAdded = tag.isCustom
      ? customTagsToAdd.find((t) => t.tagName === tag.tagName)
      : defaultTagsToAdd.find((t) => t.tagName === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);

    return inAdded !== undefined || (isCurrManhwaTag && !inRemoved);
  };

  // Derived store to track the current status of tags (whether they are removable or not)
  const currTagsStatuses = $derived(
    Object.entries(manhwaStore.allTags).map((record) => {
      const [tagName, tag] = record;
      return { tagName, isCustom: tag.custom, removable: removable({ tagName, isCustom: tag.custom ?? false }) };
    })
  );

  async function handleSave() {
    const allTagsAfterRemoval = [
      ...$state.snapshot(
        customTags.map((t) => {
          return { tagName: t, isCustom: true } as Tags;
        })
      ),
      ...$state.snapshot(
        defaultTags.map((t) => {
          return { tagName: t, isCustom: false } as Tags;
        })
      )
    ]
      .filter((tag) => manhwa?.tags.some((t) => t.tagName === tag.tagName)) // Keep only tags that are currently associated with the manhwa
      .filter((tag) => !tagsToBeRemoved.some((t) => t.tagName === tag.tagName)); // Remove tags that are marked for removal

    const tagsToAdd = [...customTagsToAdd, ...defaultTagsToAdd];
    const finalTags = [...allTagsAfterRemoval, ...tagsToAdd];

    await manhwaStore.update(manhwa.id, { tags: finalTags }, true);

    tagsToBeRemoved = [];
    customTagsToAdd = [];
    defaultTagsToAdd = [];
  }

  async function onInputEnter(event: KeyboardEvent) {
    if (event.key === "Enter") {
      addCustomTag();
    }
  }

  function removeTag(tag: Tags) {
    const inAdded = tag.isCustom
      ? customTagsToAdd.some((t) => t.tagName === tag.tagName)
      : defaultTagsToAdd.some((t) => t.tagName === tag.tagName);
    const inDefaultTags = defaultTags.some((t) => t === tag.tagName);
    const inCustomTags = customTags.some((t) => t === tag.tagName);
    if (tag.isCustom) {
      if (inCustomTags && !inAdded) {
        tagsToBeRemoved.push(tag);
      } else {
        customTagsToAdd = customTagsToAdd.filter((t) => t.tagName !== tag.tagName);
      }
    } else {
      if (inDefaultTags && !inAdded) {
        tagsToBeRemoved.push(tag);
      } else {
        defaultTagsToAdd = defaultTagsToAdd.filter((t) => t.tagName !== tag.tagName);
      }
    }
  }

  function addDefaultTag(tag: Tags) {
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === tag.tagName);
    const inAdded = defaultTagsToAdd.some((t) => t.tagName === tag.tagName);
    const inDefaultTags = defaultTags.some((t) => t === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);
    if (!inAdded && !inRemoved && !isCurrManhwaTag) {
      defaultTagsToAdd.push(tag);
    } else if (inDefaultTags && inRemoved) {
      tagsToBeRemoved = tagsToBeRemoved.filter((t) => t.tagName !== tag.tagName);
    }
  }

  function addCustomTag() {
    if (!customTagInput.trim()) {
      addATag = false;
      return;
    }
    const capitalizedTag = customTagInput.trim().charAt(0).toUpperCase() + customTagInput.trim().slice(1);
    if (manhwa.tags.some((t) => t.tagName === capitalizedTag)) {
      customTagInput = "";
      addATag = false;
      return;
    }
    const newTag: Tags = { tagName: capitalizedTag, isCustom: true };
    if (customTagsToAdd.find((tag) => tag.tagName === newTag.tagName)) {
      customTagInput = "";
      return;
    }
    customTagsToAdd.push(newTag);
    customTagInput = "";
    addATag = false;
  }

  function handleDefaultTagClick(tag: Tags) {
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === tag.tagName);
    const inAdded = defaultTagsToAdd.some((t) => t.tagName === tag.tagName);
    const inDefaultTags = defaultTags.some((t) => t === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);
    if (inAdded || (inDefaultTags && !inRemoved && isCurrManhwaTag)) {
      removeTag(tag);
    } else {
      addDefaultTag(tag);
    }
  }

  function handleCustomTagClick(tag: Tags) {
    // Calling this implies tag is is in Customtags
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === tag.tagName);
    const inAdded = customTagsToAdd.some((t) => t.tagName === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);
    if (inAdded || (!inRemoved && isCurrManhwaTag)) {
      removeTag(tag);
    } else if (inRemoved) {
      tagsToBeRemoved = tagsToBeRemoved.filter((t) => t.tagName !== tag.tagName);
    } else if (!isCurrManhwaTag) {
      customTagsToAdd.push(tag);
    }
  }

  async function handleCustomTagInput() {
    if (addATag) {
      addCustomTag();
    } else {
      addATag = true;
      await tick();
      customTagInputRef?.focus();
    }
  }

  // Custom spin/rotation transition
  function spin(node: any, { duration = 500, delay = 0, degrees = 360 } = {}) {
    return {
      delay,
      duration,
      easing: cubicOut,
      css: (t: number) => `transform: rotate(${t * degrees}deg); transform-origin: center;`
    };
  }
</script>

<InfoBox
  bind:open={showInfoBox}
  title="Tag Management"
  secondaryLabel="Save"
  onClick={handleSave}
  tagPicked={customTagsToAdd.length + defaultTagsToAdd.length + tagsToBeRemoved.length > 0}
>
  <div class="all-tags">
    <h3>Default Tags</h3>
    <div class="default-tags">
      {#each defaultTags as tag (tag)}
        <TagModifier
          text={tag}
          onClick={() => handleDefaultTagClick({ tagName: tag, isCustom: false })}
          toAdd={!currTagsStatuses.find((t) => t.tagName === tag && !t.isCustom)?.removable || false}
        />
      {/each}
    </div>
    <h3>Custom Tags</h3>
    <div class="custom-tags">
      {#each customTags as tag (tag)}
        <TagModifier
          text={tag}
          onClick={() => handleCustomTagClick({ tagName: tag, isCustom: true })}
          toAdd={!currTagsStatuses.find((t) => t.tagName === tag && t.isCustom)?.removable || false}
        />
      {/each}
      {#each customTagsToAdd.filter((tag) => !customTags.some((t) => t === tag.tagName)) as tag (tag.tagName)}
        <TagModifier
          text={tag.tagName}
          onClick={() => handleCustomTagClick(tag)}
          toAdd={!removable(tag) || false}
        />
      {/each}
      {#if addATag}
        <input
          in:fade={{ delay: 0, duration: 500, easing: cubicOut }}
          type="text"
          placeholder="Add tag..."
          class="custom-tag-input"
          bind:value={customTagInput}
          bind:this={customTagInputRef}
          onkeydown={onInputEnter}
        />
      {/if}
      <button aria-label="Add Custom Tag" class="add-custom-tag" onclick={handleCustomTagInput}>
        {#if addATag}
          <svg
            class="check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            in:spin={{ duration: 500, degrees: 360 }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        {/if}
        {#if !addATag}
          <svg
            class="plus"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            in:spin={{ duration: 500, degrees: 360 }}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        {/if}
      </button>
    </div>
  </div>
</InfoBox>
<Tag text="Edit Tags" onClick={() => (showInfoBox = !showInfoBox)} />

<style>
  .all-tags {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    max-height: 480px;
    overflow-y: auto;
  }
  .default-tags {
    padding: 5px 0px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
    max-height: 280px;
    overflow-y: auto;
  }

  .default-tags::-webkit-scrollbar {
    width: 6px;
  }

  .default-tags::-webkit-scrollbar-track {
    background: transparent;
  }

  .default-tags::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    width: 0px;
  }

  .default-tags::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(90deg, #41439d, #5a63ad);
  }

  .custom-tags {
    padding: 5px 0px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
    max-height: 280px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .custom-tags::-webkit-scrollbar {
    width: 6px;
  }

  .custom-tags::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-tags::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    width: 0px;
  }

  .custom-tags::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(90deg, #41439d, #5a63ad);
  }

  .add-custom-tag {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 9999px;
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border: 1px solid;
    border-color: #818cf8;
    color: #e2e8f0;
    cursor: pointer;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      color 200ms ease;
  }
  .add-custom-tag:active:hover {
    transform: scale(0.9) translateY(1px);
    border-color: #475569;
    color: #e8ebf0;
  }

  .add-custom-tag:hover {
    transform: scale(1) translateY(-4px);
    /* border-color: #475569; */
    color: #e8ebf0;
  }
  .add-custom-tag > svg.plus {
    rotate: 45deg;
  }

  .custom-tag-input {
    width: 100px;
    padding: 4px 8px;
    border-radius: 9999px;
    border: 1px solid;
    border-color: #818cf8;
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    color: #e2e8f0;
    font-size: 13px;
    outline: none;
  }

  .custom-tag-input::placeholder {
    color: #e2e8f0;
  }
</style>
