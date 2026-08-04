<script lang="ts">
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import * as tagManager from "@/lib/tagManager";
  import InfoBox from "./PopupBoxes/InfoBox.svelte";
  import Tag from "./Tag.svelte";
  import type { TagTracker } from "@/types";

  interface TagFilterProps {
    size?: number;
    showHidden?: boolean;
  }

  let { size = 34, showHidden = false }: TagFilterProps = $props();

  let open = $state(false);
  async function handleTagClick(tag: string) {
    if (showHidden) {
      await tagManager.setHiddenTagActive(tag, !manhwaStore.hiddenTags[tag].active);
    } else {
      await tagManager.setTagActive(tag, !manhwaStore.allTags[tag].active);
    }
  }

  async function handleClearTags() {
    if (showHidden) {
      await tagManager.clearAllHiddenActiveTags();
    } else {
      await tagManager.clearAllActiveTags();
    }
  }

  function correctTagsToDisplay(tags: Record<string, TagTracker>) {
    const correctedTags: Record<string, TagTracker> = {};
    for (const [tagName, tracker] of Object.entries(tags)) {
      if (tracker.count > 0) {
        correctedTags[tagName] = tracker;
      }
    }
    return correctedTags;
  }

  let tagsToDisplay = $derived(
    showHidden ? correctTagsToDisplay(manhwaStore.hiddenTags) : correctTagsToDisplay(manhwaStore.allTags)
  );
  let selected = $derived(
    Object.fromEntries(Object.entries(tagsToDisplay).filter(([_, tracker]) => tracker.active))
  );

  let selectedCount = $derived(Object.keys(selected).length);
</script>

<InfoBox
  bind:open
  title="Filter by Tag"
  secondaryLabel="Clear Filter"
  onClick={handleClearTags}
  tagPicked={selectedCount > 0}
>
  <div class="all-tags">
    {#each Object.entries(tagsToDisplay) as [tag, tracker] (tag)}
      <Tag text={`${tag} (${tracker.count})`} onClick={() => handleTagClick(tag)} filtered={tracker.active} />
    {/each}
  </div>
</InfoBox>
{#if selectedCount === 0}
  <button aria-label="Filter" class="filter-btn" onclick={() => (open = !open)} style="--size: {size}px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />

      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />

      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  </button>
{:else if selectedCount > 0}
  {#each Object.entries(selected).slice(0, 1) as [tag, tracker] (tag)}
    <Tag text={tag} filtered={tracker.active} onClick={() => handleTagClick(tag)} />
  {/each}
  {#if selectedCount > 1}
    <Tag
      text={`+${selectedCount - 1} more`}
      filtered={false}
      filterControl={true}
      onClick={() => (open = !open)}
    />
  {/if}
{/if}

<style>
  .filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: var(--size);
    max-height: var(--size);
    height: var(--size);
    width: 100%;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    color: #64748b;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .filter-btn svg {
    width: 16px;
    height: 16px;
  }

  .filter-btn:hover {
    border-color: #475569;
    color: #dbdfe6;
  }

  .filter-btn:active {
    transform: scale(0.9);
  }

  .all-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
    overflow-y: auto;
    max-height: 280px;
  }

  .all-tags::-webkit-scrollbar {
    width: 6px;
  }

  .all-tags::-webkit-scrollbar-track {
    background: transparent;
  }

  .all-tags::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    width: 0px;
  }

  .all-tags::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(90deg, #41439d, #5a63ad);
  }

  @keyframes pop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
