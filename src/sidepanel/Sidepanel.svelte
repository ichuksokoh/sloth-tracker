<script lang="ts">
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import { getSelectedManhwa, onSelectedManhwaChange } from "@/lib/selectedManhwa.svelte";
  import { retrieveCover } from "@/lib/coverCache.svelte";
  import * as tagManager from "@/lib/tagManager";
  import * as fields from "@/lib/storageField";
  import type { Manhwa } from "@/types";
  import Button from "@/components/Buttons/Button.svelte";
  import FavoriteButton from "@/components/Buttons/FavoriteButton.svelte";
  import HideButton from "@/components/Buttons/HideButton.svelte";
  import ProgressBar from "@/components/ProgressBar.svelte";
  import StatusBar from "@/components/StatusBar.svelte";
  import ChapterDropdown from "@/components/Dropdowns/ChapterDropdown.svelte";
  import DescriptionDrawer from "@/components/DescriptionDrawer.svelte";
  import RatingBar from "@/components/RatingBar.svelte";
  import GoToBtn from "@/components/Buttons/GoToBtn.svelte";
  import AlertBox from "@/components/PopupBoxes/AlertBox.svelte";
  import Tag from "@/components/TagManagers/Tag.svelte";
  import InfoBox from "@/components/PopupBoxes/InfoBox.svelte";
  import EditTags from "@/components/TagManagers/EditTags.svelte";
  import Notes from "@/components/Notes.svelte";
  import DatePicker from "@/components/DatePicker.svelte";
  import ToastContainer from "@/components/ToastContainer.svelte";

  // tracks open/close status of the side panel for view in library button
  chrome.windows.getCurrent().then((win) => {
    if (win.id === undefined) return;
    const port = chrome.runtime.connect({ name: "sidepanel-heartbeat" });
    port.postMessage({ windowId: win.id });
  });

  // Handling of Selected Manhwa from Popup library view to Side Panel view
  let selectedId = $state<string | null>(null);

  let selectedManhwa = $derived<Manhwa | undefined>(manhwaStore.list.find((m) => m.id === selectedId));

  let shownTags = $derived(
    [...(selectedManhwa?.tags ?? [])]
      .sort((a, b) => {
        const aIsCustom = a.isCustom ? 1 : 0;
        const bIsCustom = b.isCustom ? 1 : 0;
        if (aIsCustom !== bIsCustom) {
          return aIsCustom - bIsCustom; // Custom tags come after default tags
        }
        return a.tagName.localeCompare(b.tagName); // Sort alphabetically within each group
      })
      .slice(0, selectedManhwa && selectedManhwa.tags.length > 4 ? 3 : (selectedManhwa?.tags.length ?? 0))
  );
  let showMore = $derived(selectedManhwa ? selectedManhwa.tags.length > 4 : false);
  let moreTags = $derived(selectedManhwa && shownTags ? selectedManhwa.tags.length - shownTags.length : 0);
  let openClosetags = $state(false);
  let markUnreadOne = $state(false); // false = mark all Unread, true = mark only one unread

  const cover = retrieveCover(() => selectedManhwa);
  let isLandscape = $state(false);
  function handleCoverLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    isLandscape = img.naturalWidth > img.naturalHeight;
  }

  $effect(() => {
    getSelectedManhwa().then((id) => {
      selectedId = id;
    });

    const unsubscribe = onSelectedManhwaChange((id) => {
      selectedId = id;
    });

    return unsubscribe;
  });

  $effect(() => {
    fields.settingsConfigs.get().then((value) => {
      if (value) {
        markUnreadOne = value.markUnreadOne;
      }
    });
  });

  fields.settingsConfigs.onChange((value) => {
    if (value) {
      markUnreadOne = value.markUnreadOne;
    }
  });

  // Handling of Chapter Selection and Status Update
  async function handleChapterSelect(chapterNumber: number) {
    if (selectedManhwa) {
      let falsePrior = true;
      const chapters = selectedManhwa.chapters.map((chp) => {
        if (chp.number <= chapterNumber) {
          if (chp.number === chapterNumber && chp.read) {
            falsePrior = false;
          }
          return { ...chp, read: true };
        }
        if (markUnreadOne) {
          return { ...chp };
        }
        return { ...chp, read: false };
      });

      const finalChapters = chapters.map((chp, i) => {
        if (chp.number === chapterNumber && !falsePrior) {
          chapterNumber = i > 0 ? chapters[i - 1].number : chp.number;
          return { ...chp, read: false };
        }
        return chp;
      });
      const setToPlan = chapterNumber === finalChapters[0].number && !finalChapters[0].read;
      manhwaStore.update(selectedManhwa.id, {
        currentChapter: chapterNumber,
        status: setToPlan ? "Plan To Read" : "Reading",
        startedOn: selectedManhwa.startedOn ?? Date.now(),
        chapters: finalChapters,
        completedOn: null // Clear the completedOn date when marking as reading
      });
    }
  }

  // Function to delete a manhwa and its cached cover
  async function deleteManhwa(id: string) {
    if (!id || id === "") return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.close({ windowId: tab.windowId });
    }
    await manhwaStore.remove(id);
  }

  // Status management
  const statusValues = ["Plan To Read", "Reading", "Completed", "Dropped", "On Hold"] as const;

  let selectedStatus = $derived(selectedManhwa?.status ?? "Plan To Read");

  function handleStatusSelect(label: string) {
    if (selectedManhwa && (statusValues as readonly string[]).includes(label)) {
      if (label === "Completed") {
        // Mark all chapters as read when status is set to "Completed"
        const updatedChapters = selectedManhwa.chapters.map((chp) => ({ ...chp, read: true }));
        const currentChapter =
          updatedChapters.length > 0
            ? updatedChapters[updatedChapters.length - 1].number
            : selectedManhwa.currentChapter;
        const completedOn = Date.now();
        manhwaStore.update(selectedManhwa.id, {
          status: label,
          chapters: updatedChapters,
          completedOn,
          currentChapter
        });
      } else if (label === "Reading") {
        const startedOn = Date.now();
        manhwaStore.update(selectedManhwa.id, { status: label, startedOn });
      } else {
        manhwaStore.update(selectedManhwa.id, { status: statusValues.find((s) => s === label) });
      }
    }
  }

  // Favorite management
  async function toggleFavorite() {
    if (selectedManhwa) {
      await manhwaStore.update(selectedManhwa.id, {
        favorite: !selectedManhwa.favorite,
        updatedAt: Date.now()
      });
    }
  }

  // Function to open the manhwa's URL in a new tab
  async function openManhwaUrl() {
    if (selectedManhwa && selectedManhwa.sourceUrl) {
      await chrome.tabs.create({ url: selectedManhwa.sourceUrl });
    }
  }

  // Function to toggle the description drawer open/closed
  function toggleDescription(next: boolean) {
    if (selectedManhwa) {
      manhwaStore.update(selectedManhwa.id, { descriptionOpen: next });
    }
  }

  // Function to handle rating selection
  function handleRatingSelect(value: number) {
    if (selectedManhwa) {
      manhwaStore.update(selectedManhwa.id, { rating: value });
    }
  }

  function clearRating() {
    if (selectedManhwa) {
      manhwaStore.update(selectedManhwa.id, { rating: null });
    }
  }

  function titleFontSize(title: string): string {
    const len = title.length;
    if (len > 60) return "15px";
    if (len > 40) return "17px";
    if (len > 25) return "20px";
    return "24px";
  }

  async function openPopup() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.action.openPopup({ windowId: tab.windowId });
      chrome.sidePanel.close({ windowId: tab.windowId });
    }
  }

  let showDeleteConfirm = $state(false);
  async function toggleHidden() {
    if (selectedManhwa) {
      await manhwaStore.update(selectedManhwa.id, { hidden: !selectedManhwa.hidden });
    }
  }

  // Handle allowing clicking tags to open library with tag thwt was clicked filtered
  async function handleTagClick(tag: string) {
    await tagManager.setTagActive(tag, true);
    await chrome.action.openPopup().catch((err) => console.error("Failed to open popup:", err));
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.close({ windowId: tab.windowId });
    }
  }
</script>

<AlertBox
  bind:open={showDeleteConfirm}
  title="Delete manhwa?"
  confirmLabel="Delete"
  confirmColorFrom="#7f1d1d"
  confirmColorTo="#450a0a"
  onConfirm={() => deleteManhwa(selectedManhwa?.id ?? "")}
>
  This will remove <strong>{selectedManhwa?.title}</strong> and its cached cover from your library. This can't be undone.
</AlertBox>

<InfoBox bind:open={openClosetags} title="Tags">
  <div class="all-tags">
    {#if selectedManhwa && selectedManhwa?.tags.length > 0}
      <h3>Default Tags</h3>
      <div class="default-tags">
        {#each selectedManhwa.tags.filter((tag) => !tag.isCustom) as tag, i (i)}
          <Tag text={tag.tagName} onClick={() => handleTagClick(tag.tagName)} />
        {/each}
      </div>
      <h3>Custom Tags</h3>
      <div class="custom-tags">
        {#each selectedManhwa.tags.filter((tag) => tag.isCustom) as tag, i (i)}
          <Tag text={tag.tagName} onClick={() => handleTagClick(tag.tagName)} />
        {/each}
      </div>
    {:else}
      <p>No tags available.</p>
    {/if}
  </div>
</InfoBox>

{#snippet linkToSvg()}
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M18 13 L18 19 A2 2 0 0 1 16 21 L5 21 A2 2 0 0 1 3 19 L3 8 A2 2 0 0 1 5 6 L11 6" />
    <path d="M15 3 L21 3 L21 9" />
    <path d="M10 14 L21 3" />
  </svg>
{/snippet}
<!-- <div> -->
<div class="manhwa_info">
  {#if selectedManhwa}
    <div class="title-row">
      <h1 style="font-size: {titleFontSize(selectedManhwa.title)};">{selectedManhwa.title}</h1>
    </div>

    <div class="cover-wrap" class:is-landscape={isLandscape}>
      {#if cover.url}
        <img src={cover.url} alt={selectedManhwa.title} loading="lazy" onload={handleCoverLoad} />
      {:else}
        <div class="cover-placeholder">No Cover</div>
      {/if}
    </div>

    <div class="controls-stack">
      <RatingBar rating={selectedManhwa.rating} onSelect={handleRatingSelect} onClear={clearRating} />
      <ProgressBar manhwa={selectedManhwa} />
      <StatusBar labels={statusValues} selected={selectedStatus} onSelect={handleStatusSelect} />
      <!-- <Rating rating={selectedManhwa.rating} onSelect={handleRatingSelect} /> -->
      <div class="dates-row">
        <DatePicker manhwa={selectedManhwa} forStatus="Reading" />
        <DatePicker manhwa={selectedManhwa} forStatus="Completed" />
      </div>
      <div class="controls-row">
        <GoToBtn label="Read at" onClick={openManhwaUrl} icon={linkToSvg} />
        <ChapterDropdown manhwa={selectedManhwa} onSelect={handleChapterSelect} />
        <FavoriteButton favorite={selectedManhwa.favorite} onToggle={toggleFavorite} />
        <HideButton hidden={selectedManhwa.hidden} onToggle={toggleHidden} />
      </div>
      <div class="genre-tags">
        {#each shownTags as tag, i (i)}
          <Tag text={tag.tagName} onClick={() => handleTagClick(tag.tagName)} />
        {/each}
        {#if showMore}
          <Tag text={`+${moreTags} more`} onClick={() => (openClosetags = true)} />
        {/if}
        <EditTags manhwa={selectedManhwa} />
      </div>
      <Notes manhwa={selectedManhwa} />
      {#if selectedManhwa.description}
        <DescriptionDrawer
          description={selectedManhwa.description}
          open={selectedManhwa.descriptionOpen ?? false}
          onToggle={toggleDescription}
        />
      {/if}
      <div class="button-row">
        <Button label="Open Library" colorFrom="#1e293b" colorTo="#334155" onclick={openPopup} />
        <Button label="Delete" colorFrom="#7f1d1d" colorTo="#450a0a" onclick={() => (showDeleteConfirm = true)} />
      </div>
    </div>
  {:else}
    <p class="no-manhwa">No Manhwa Selected</p>
  {/if}
  <ToastContainer />
</div>

<!-- </div> -->

<style>
  .manhwa_info {
    max-width: 100%;
    /* max-height: 100%; */
    height: 100vh;
    overflow-y: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, #0f172a 0%, #34316b6f, 50%, #182542cb 100%);
    /* scrollbar-width: thin;
    scrollbar-color: #475569 transparent; */
  }

  .manhwa_info::-webkit-scrollbar {
    width: 0px;
  }

  .manhwa_info::-webkit-scrollbar-track {
    background: transparent;
  }

  .manhwa_info::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    width: 0px;
  }

  .manhwa_info::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(90deg, #41439d, #5a63ad);
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0 4px 4px;
  }

  .title-row h1 {
    margin: 0;
    text-align: center;
    line-height: 1.25;
    word-break: break-word;
  }

  .cover-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: 320px;
    border-radius: 8px;
  }

  .cover-wrap.is-landscape {
    max-width: 550px;
  }

  .cover-wrap img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    object-fit: contain;
  }

  /* Portrait (default): tall aspect, floor at 320×420 */
  .cover-wrap:not(.is-landscape) img {
    min-width: 320px;
    min-height: 420px;
    max-width: 400px;
    max-height: 550px;
  }

  /* Landscape: wide aspect, floor at 320×200, grows with the panel */
  .cover-wrap.is-landscape img {
    min-width: 320px;
    min-height: 200px;
    max-width: 100%;
    max-height: 450px;
  }

  .cover-placeholder {
    width: 320px;
    height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 24px;
    border-radius: 8px;
    background: #1e293b;
  }

  .controls-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0;
    padding: 0 4px;
    min-width: 320px;
    max-width: 450px;
    width: 100%;
    /* align-self: stretch; */
  }
  .controls-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dates-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .genre-tags {
    display: flex;
    gap: 5px;
    height: 45px;
    flex-direction: row;
    justify-content: center;
    /* max-width: 250px; */
  }

  .all-tags {
    text-align: center;
    max-height: 480px;
    overflow-y: auto;
  }

  .default-tags {
    padding: 10px 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
    max-height: 175px;
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
    padding: 5px 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    align-items: center;
    max-height: 150px;
    overflow-y: auto;
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

  .icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .button-row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-top: 10px;
  }

  .no-manhwa {
    text-align: center;
    color: #ffffff;
    font-size: 16px;
    font-weight: 400;
    margin-top: 40px;
  }
</style>
