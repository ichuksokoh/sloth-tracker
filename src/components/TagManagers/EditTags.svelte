<script lang="ts">
  import TagModifier from "./TagModifier.svelte";
  import Tag from "./Tag.svelte";
  import InfoBox from "../PopupBoxes/InfoBox.svelte";
  import type { Tags } from "@/types";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import { cubicOut } from "svelte/easing";
  import type { Manhwa } from "@/types";
  import { fade } from "svelte/transition";
  import { tick } from "svelte";
  import Searchbar from "../SearchBar.svelte";
  import { stringSimilarity } from "@/lib/titleMatch";
  import SearchBar from "../SearchBar.svelte";
  import { toastStore } from "@/lib/toastStore.svelte";

  interface EditTagsProps {
    manhwa: Manhwa;
  }

  let { manhwa }: EditTagsProps = $props();

  let searchQuery = $state("");

  function clearSearch() {
    searchQuery = "";
  }

  function generateTagView(isDefault: boolean = true) {
    const value = searchQuery.trim();
    if (isDefault) {
      if (value === "") {
        return Object.keys(manhwaStore.allTags).filter((tagName) => !manhwaStore.allTags[tagName].custom);
      } else {
        return Object.keys(manhwaStore.allTags).filter(
          (tagName) =>
            !manhwaStore.allTags[tagName].custom &&
              (stringSimilarity(tagName.toLowerCase(), value.toLowerCase()) > 0.5 ||
            tagName.toLowerCase().includes(value.toLowerCase()))
        );
      }
    } else {
      if (value === "") {
        return Object.keys(manhwaStore.allTags).filter((tagName) => manhwaStore.allTags[tagName].custom);
      } else {
        return Object.keys(manhwaStore.allTags).filter(
          (tagName) =>
            manhwaStore.allTags[tagName].custom &&
              (stringSimilarity(tagName.toLowerCase(), value.toLowerCase()) > 0.5 ||
            tagName.toLowerCase().includes(value.toLowerCase()))
        );
      }
    }
  }

  const defaultTags = $derived.by(() => {
    return generateTagView(true);
  });

  const customTags = $derived.by(() => {
    return generateTagView(false);
  });

  let customTagsToAdd = $state<Tags[]>([]);
  let defaultTagsToAdd = $state<Tags[]>([]);

  let tagsToBeRemoved = $state<Tags[]>([]); // for preexisting tags that are being removed

  let customTagInput = $state("");
  let customTagInputRef = $state<HTMLInputElement | null>(null);
  const customTagInputWidth = $derived(Math.min(120, Math.max(80, customTagInput.length * 8 + 16)));

  let showInfoBox = $state(false);

  let addATag = $state(false);

  // Only for when user tries to add a custom tag that is already a default tag
  let errmsg = $state("");

  $effect(() => {
    if (customTagInput === "" && errmsg) {
      errmsg = "";
    }

    if (customTagInput.length > 25) {
      errmsg = "Tag cannot be longer than 25 characters";
      customTagInput = customTagInput.slice(0, 25);
      return;
    }

    if (errmsg) {
      const timer = setTimeout(() => {
        errmsg = "";
      }, 3000);
      return () => clearTimeout(timer);
    }
  });
  // Function to determine if a tag is removable (i.e., not already marked for removal or addition)
  const removable = (tag: Omit<Tags, "hidden">) => {
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === tag.tagName);
    const inAdded = tag.isCustom
      ? customTagsToAdd.some((t) => t.tagName === tag.tagName)
      : defaultTagsToAdd.some((t) => t.tagName === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);

    return inAdded || (isCurrManhwaTag && !inRemoved);
  };

  // Derived store to track the current status of tags (whether they are removable or not)
  const currTagsStatuses = $derived(
    Object.entries(manhwaStore.allTags).map((record) => {
      const [tagName, tag] = record;
      return {
        tagName,
        isCustom: tag.custom,
        removable: removable({ tagName, isCustom: tag.custom })
      };
    })
  );

  async function handleSave() {
    const allTagsAfterRemoval = $state
      .snapshot(manhwa.tags)
      .filter((tag) => !tagsToBeRemoved.some((t) => t.tagName === tag.tagName)); // remove tags that are marked for removal

    const tagsToAdd = [...customTagsToAdd, ...defaultTagsToAdd];
    const finalTags = [...allTagsAfterRemoval, ...tagsToAdd];

    await manhwaStore.update(manhwa.id, { tags: finalTags }, true);

    tagsToBeRemoved = [];
    customTagsToAdd = [];
    defaultTagsToAdd = [];
    toastStore.show("Tags updated successfully");
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
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);
    if (tag.isCustom) {
      if (isCurrManhwaTag && !inAdded) {
        tagsToBeRemoved.push(tag);
      } else {
        customTagsToAdd = customTagsToAdd.filter((t) => t.tagName !== tag.tagName);
      }
    } else {
      if (isCurrManhwaTag && !inAdded) {
        tagsToBeRemoved.push(tag);
      } else {
        defaultTagsToAdd = defaultTagsToAdd.filter((t) => t.tagName !== tag.tagName);
      }
    }
  }

  function addDefaultTag(tag: Tags) {
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === tag.tagName);
    const inAdded = defaultTagsToAdd.some((t) => t.tagName === tag.tagName);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === tag.tagName);
    if (!inAdded && !inRemoved && !isCurrManhwaTag) {
      defaultTagsToAdd.push(tag);
    } else if (inRemoved) {
      tagsToBeRemoved = tagsToBeRemoved.filter((t) => t.tagName !== tag.tagName);
    }
  }

  function addCustomTag() {
    if (!customTagInput.trim()) {
      addATag = false;
      return;
    }
    const capitalizedTag = customTagInput.trim().charAt(0).toUpperCase() + customTagInput.trim().slice(1);
    const isCurrManhwaTag = manhwa.tags.some((t) => t.tagName === capitalizedTag);
    const inRemoved = tagsToBeRemoved.some((t) => t.tagName === capitalizedTag);
    const inDefaultTags = defaultTags.some((t) => t === capitalizedTag);
    if ((isCurrManhwaTag && !inRemoved) || inDefaultTags) {
      if (inDefaultTags) {
        errmsg = "Cannot add a default tag";
      } else {
        errmsg = "Custom tag already applied";
      }
      // customTagInput = "";
      // addATag = false;
      return;
    }

    if (inRemoved) {
      tagsToBeRemoved = tagsToBeRemoved.filter((t) => t.tagName !== capitalizedTag);
      customTagInput = "";
      addATag = false;
      return;
    }

    const newTag: Tags = { tagName: capitalizedTag, isCustom: true, hidden: manhwa.hidden };
    if (customTagsToAdd.find((tag) => tag.tagName === newTag.tagName)) {
      errmsg = "Custom tag already added";
      // customTagInput = "";
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

  // Calling this implies tag is is in Customtags
  function handleCustomTagClick(tag: Tags) {
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
  showSecondary={customTagsToAdd.length + defaultTagsToAdd.length + tagsToBeRemoved.length > 0}
>
  <SearchBar bind:searchQuery onSearch={() => {}} onClear={clearSearch} placeholder="Search tags..." />
  <div class="all-tags">
    <h3>Default Tags</h3>
    <div class="default-tags">
      <div class="default-tags-list">
        {#each defaultTags as tag (tag)}
          <TagModifier
            text={tag}
            onClick={() => handleDefaultTagClick({ tagName: tag, isCustom: false, hidden: manhwa.hidden })}
            toAdd={!currTagsStatuses.find((t) => t.tagName === tag && !t.isCustom)?.removable || false}
          />
        {/each}
      </div>
    </div>
    <h3>Custom Tags</h3>
    <div class="custom-tags">
      <div class="custom-tags-list">
        {#each customTags as tag (tag)}
          <TagModifier
            text={tag}
            onClick={() => handleCustomTagClick({ tagName: tag, isCustom: true, hidden: manhwa.hidden })}
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
            style="width: {customTagInputWidth}px"
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
      {#if errmsg}
        <p transition:fade={{ duration: 300, delay: 0, easing: cubicOut }} class="error-msg">{errmsg}</p>
      {/if}
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
    align-content: start;
    max-height: 280px;
    min-height: 150px;
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

  .default-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
  }

  .custom-tags {
    padding: 5px 0px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    /* justify-content: center; */
    align-content: start;
    align-items: center;
    max-height: 280px;
    min-height: 150px;
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

  .custom-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
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
    min-width: 80px;
    max-width: 120px;
    height: 32px;
    padding: 4px 8px;
    border-radius: 9999px;
    border: 1px solid;
    border-color: #818cf8;
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    color: #e2e8f0;
    font-size: 13px;
    outline: none;
  }

  .error-msg {
    color: #f87171;
    font-size: 12px;
    font-weight: 500;
    margin: 0;
  }

  .custom-tag-input::placeholder {
    color: #e2e8f0;
  }
</style>
