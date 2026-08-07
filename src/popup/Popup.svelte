<script lang="ts">
  import type { Manhwa, SortField, SortDirection } from "@/types";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import { setSelectedManhwaAll } from "@/lib/selectedManhwa.svelte";
  import * as fields from "@/lib/storageField";
  import * as tagManager from "@/lib/tagManager";
  import { matchesSearch, compareSearchRank, bestSearchRank } from "@/lib/titleMatch";
  import Card from "@/components/Card.svelte";
  import StatusBar from "@/components/StatusBar.svelte";
  import FavoriteButton from "@/components/Buttons/FavoriteButton.svelte";
  import HideButton from "@/components/Buttons/HideButton.svelte";
  import AlertBox from "@/components/PopupBoxes/AlertBox.svelte";
  import SortByDropdown from "@/components/Dropdowns/SortByDropdown.svelte";
  import SortByDirBtn from "@/components/Buttons/SortByDirBtn.svelte";
  import TagFilter from "@/components/TagManagers/TagFilter.svelte";
  import SearchBar from "@/components/SearchBar.svelte";

  let searchQuery = $state("");
  let debouncedQuery = $state(""); // updates after typing pauses, drives the filter
  let isSearching = $state(false); // true during the "waiting to settle" window
  let status = $state("All"); // 'All', 'Reading', 'Plan To Read', 'Completed', 'Dropped'
  const statusValues = ["All", "Plan To Read", "Reading", "Completed", "Dropped"] as const;
  const sortByOptions = [
    "Title",
    "Recently Added",
    "Recently Updated",
    "Rating",
    "Progress",
    "Recently Completed"
  ];

  const fieldComparators: Record<SortField, (a: Manhwa, b: Manhwa) => number> = {
    Title: (a, b) => a.title.localeCompare(b.title),
    "Recently Added": (a, b) => a.createdAt - b.createdAt,
    "Recently Updated": (a, b) => a.updatedAt - b.updatedAt,
    Rating: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
    Progress: (a, b) => {
      const aP = a.totalChapters ? a.currentChapter / a.totalChapters : 0;
      const bP = b.totalChapters ? b.currentChapter / b.totalChapters : 0;
      return aP - bP;
    },
    "Recently Completed": (a, b) => {
      const aDate = a.completedOn ?? 0;
      const bDate = b.completedOn ?? 0;
      return aDate - bDate;
    }
  };

  function manhwasSortBy(a: Manhwa, b: Manhwa, field: SortField, direction: SortDirection) {
    const primary = fieldComparators[field](a, b);
    const signed = direction === "asc" ? primary : -primary;
    if (signed !== 0) return signed;
    return a.title.localeCompare(b.title); // tiebreak stays constant regardless of direction
  }
  let showFavoritesOnly = $state(false);
  let hideManwhaCount = $state(false); // hide the total manhwa count in the popup view
  let showHiddenOnly = $state(false); // show only hidden manhwa
  let sortByField = $state<SortField>("Title"); // default sort by field
  let sortByDirection = $state<SortDirection>("asc"); // default sort by direction

  // Front-end Client side filtering of the manhwa list based on search query, status filter, and favorites filter
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSearchInput() {

    isSearching = true;

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedQuery = searchQuery;
      isSearching = false;
      fields.searchQuery.set(searchQuery); // persist to session storage once settled
    }, 250);
  }

  const compare = (a: Manhwa) => {
    const allTags = manhwaStore.allTags;
    const titleMatches = matchesSearch(debouncedQuery, a.title);
    const statusMatches = status === "All" || a.status === status;
    const favoriteMatches = !showFavoritesOnly || a.favorite;
    const hiddenMatches = showHiddenOnly ? a.hidden : !a.hidden;
    // Show all is defualt for filtering purposes user does not actually see this
    const showAll = Object.values(allTags).every((tag) => !tag.active);
    const tagsMatches = a.tags.some((tag) => allTags[tag.tagName] && allTags[tag.tagName].active) || showAll;
    return titleMatches && statusMatches && favoriteMatches && hiddenMatches && tagsMatches;
  };

  let filtered = $derived.by(() => {
    const withRank = manhwaStore.list
      .map((m) => ({ m, match: bestSearchRank(debouncedQuery, [m.title]) }))
      .filter(
        ({ m, match }) => (debouncedQuery.trim() ? match !== null : true) && compare(m)
      );

    if (debouncedQuery.trim()) {
      return withRank.sort((a, b) => compareSearchRank(a.match!, b.match!)).map(({ m }) => m);
    }
    return withRank.map(({ m }) => m).sort((a, b) => manhwasSortBy(a, b, sortByField, sortByDirection));
  });
  function handleStatusSelect(label: string) {
    status = label;
    fields.statusFilter.set(label);
  }

  function handleShowFavoritesToggle() {
    showFavoritesOnly = !showFavoritesOnly;
    fields.showFavoritesOnly.set(showFavoritesOnly);
  }

  function handleShowHiddenToggle() {
    showHiddenOnly = !showHiddenOnly;
    fields.hiddenFilter.set(showHiddenOnly);
  }

  function handleHideCounts() {
    hideManwhaCount = !hideManwhaCount;
    fields.toggleManhwaCount.set(hideManwhaCount);
  }

  function handleSortByFieldOption(option: SortField) {
    sortByField = option;
    fields.sortByField.set(option);
  }

  function handleSortByDirectionOption() {
    sortByDirection = sortByDirection === "asc" ? "desc" : "asc";
    fields.sortByDirection.set(sortByDirection);
  }

  // Handle persistance of search queries, show favorites only, and status filter in Chrome storage
  // hydration from storage now needs to set both variables together
  $effect(() => {
    fields.searchQuery.get().then((q) => {
      searchQuery = q;
      debouncedQuery = q;
    });
    fields.showFavoritesOnly.get().then((v) => {
      showFavoritesOnly = v;
    });
    fields.statusFilter.get().then((v) => {
      status = v;
    });
    fields.hiddenFilter.get().then((v) => {
      showHiddenOnly = v;
    });
    fields.toggleManhwaCount.get().then((v) => {
      hideManwhaCount = v;
    });
    fields.sortByField.get().then((v) => {
      sortByField = v as SortField;
    });
    fields.sortByDirection.get().then((v) => {
      sortByDirection = v as SortDirection;
    });
  });

  fields.searchQuery.onChange((q) => {
    searchQuery = q;
    debouncedQuery = q;
  });
  fields.showFavoritesOnly.onChange((v) => {
    showFavoritesOnly = v;
  });
  fields.statusFilter.onChange((v) => {
    status = v;
  });
  fields.hiddenFilter.onChange((v) => {
    showHiddenOnly = v;
  });
  fields.toggleManhwaCount.onChange((v) => {
    hideManwhaCount = v;
  });
  fields.sortByField.onChange((v) => {
    sortByField = v as SortField;
  });
  fields.sortByDirection.onChange((v) => {
    sortByDirection = v as SortDirection;
  });


  async function clearSearch() {
    searchQuery = "";
    debouncedQuery = "";

    fields.searchQuery.set("");

    await tagManager.clearAllActiveTags();

    if (showFavoritesOnly) {
      showFavoritesOnly = false;
      fields.showFavoritesOnly.set(false);
    }
    if (showHiddenOnly) {
      showHiddenOnly = false;
      fields.hiddenFilter.set(false);
    }
  }

  // Open side Panel for Manhwa Info and Chapter Selection
  async function openSidePanel(manhwa: Manhwa) {
    await setSelectedManhwaAll(manhwa.id);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  }

  let selectMode = $state(false);
  let selectedIds = $state<Set<string>>(new Set());
  let showBulkDeleteConfirm = $state(false);

  function toggleSelectMode() {
    selectMode = !selectMode;
    selectedIds = new Set();
  }

  function toggleSelect(manhwa: Manhwa) {
    const next = new Set(selectedIds);
    if (next.has(manhwa.id)) {
      next.delete(manhwa.id);
    } else {
      next.add(manhwa.id);
    }
    selectedIds = next;
  }

  async function bulkDelete() {
    for (const id of selectedIds) {
      await manhwaStore.remove(id);
    }
    selectedIds = new Set();
    selectMode = false;
  }

  let allSelected = $derived(filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id)));

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filtered.map((m) => m.id));
    }
  }
</script>

<div class="popup">
  <SearchBar bind:searchQuery onSearch={handleSearchInput} onClear={clearSearch} placeholder="Search your library…" />
  <nav class="status-nav">
    <StatusBar labels={statusValues} selected={status} onSelect={handleStatusSelect} />
    <button
      class="select-mode-toggle"
      class:is-active={selectMode}
      onclick={toggleSelectMode}
      aria-label="Select multiple"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    </button>
  </nav>
  <nav class="filter-nav">
    <SortByDirBtn direction={sortByDirection} onClick={handleSortByDirectionOption} size={32} />
    <SortByDropdown options={sortByOptions} onSelect={handleSortByFieldOption} currentSelection={sortByField} />
    <FavoriteButton favorite={showFavoritesOnly} onToggle={handleShowFavoritesToggle} forStatus={true} size={32} />
    <HideButton hidden={showHiddenOnly} onToggle={handleShowHiddenToggle} forStatus={true} size={32} />
    <TagFilter size={32} showHidden={showHiddenOnly} />
  </nav>
  <main class="grid-scroll">
    {#if isSearching}
      <p class="searching-state">
        Searching
        <span class="dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </p>
    {:else if filtered.length === 0 && status === "All" && !showFavoritesOnly}
      <p class="empty-state">Your library is empty. Add Some Manhwa!</p>
    {:else if filtered.length === 0 && !debouncedQuery}
      <p class="empty-state">No manhwa found.</p>
    {:else if debouncedQuery && filtered.length === 0}
      <p class="empty-state">No manhwas found for "{debouncedQuery}".</p>
    {:else}
      <div class="grid">
        {#each filtered as manhwa (manhwa.id)}
          <Card
            {manhwa}
            onClick={openSidePanel}
            {selectMode}
            selected={selectedIds.has(manhwa.id)}
            onToggleSelect={toggleSelect}
          />
        {/each}
      </div>
    {/if}
  </main>
  {#if selectMode}
    <footer class="bulk-bar">
      <div class="bulk-left">
        <button class="select-all-btn" onclick={toggleSelectAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <span class="bulk-count">{selectedIds.size} selected</span>
      </div>
      <div class="bulk-actions">
        <button class="bulk-cancel" onclick={toggleSelectMode}>Cancel</button>
        <button
          class="bulk-delete"
          disabled={selectedIds.size === 0}
          onclick={() => (showBulkDeleteConfirm = true)}
        >
          Delete
        </button>
      </div>
    </footer>
  {:else}
    <footer class="count-bar">
      <span class="count-text" class:is-hidden={hideManwhaCount}>
        {manhwaStore.list.length} total · {filtered.length} shown · {manhwaStore.list.filter((m) => m.favorite)
          .length} favorites · {manhwaStore.list.filter((m) => m.hidden).length} hidden
      </span>
      <button
        class="count-toggle"
        onclick={handleHideCounts}
        aria-label={hideManwhaCount ? "Show count" : "Hide count"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {#if hideManwhaCount}
            <path
              d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.28 20.28 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"
            />
            <line x1="2" y1="2" x2="22" y2="22" />
          {:else}
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          {/if}
        </svg>
      </button>
    </footer>
  {/if}
</div>
<AlertBox
  bind:open={showBulkDeleteConfirm}
  title="Delete {selectedIds.size} manhwa?"
  confirmLabel="Delete"
  confirmColorFrom="#7f1d1d"
  confirmColorTo="#450a0a"
  onConfirm={bulkDelete}
>
  This will permanently remove {selectedIds.size} manhwa and their cached covers. This can't be undone.
</AlertBox>

<style>
  :global(body) {
    margin: 0;
    background: #0f172a;
  }

  .popup {
    width: 480px;
    height: 480px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0f172a 0%, #3d4aa66f, 50%, #162244cb 100%);
    font-family: ui-sans-serif, system-ui, sans-serif;
    color: #e2e8f0;
    overflow: hidden;
    border-radius: 8px;
  }

  .searching-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #64748b;
    font-size: 13px;
    margin-top: 40px;
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: #64748b;
    animation: bounce 1.2s ease-in-out infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 150ms;
  }

  .dot:nth-child(3) {
    animation-delay: 300ms;
  }

  @keyframes bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .status-nav {
    display: flex;
    flex-shrink: 0;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0 16px 8px;
  }

  .filter-nav {
    display: flex;
    flex-shrink: 0;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0 16px 5px;
  }

  .grid-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1px 16px 16px;
  }

  .grid-scroll::-webkit-scrollbar {
    width: 8px;
  }

  .grid-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .grid-scroll::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .grid-scroll::-webkit-scrollbar-thumb:hover {
    background: #475569;
    background-clip: padding-box;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    padding: 5px 0 0;
  }

  .empty-state {
    text-align: center;
    color: #64748b;
    font-size: 13px;
    margin-top: 40px;
    overflow-wrap: break-word;
    white-space: normal;
  }

  .count-bar {
    flex-shrink: 0;
    height: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid #1e293b;
  }

  .count-text {
    font-size: 11px;
    color: #475569;
    font-variant-numeric: tabular-nums;
    transition:
      opacity 200ms ease,
      color 300ms ease-in-out;
  }

  .count-text:hover {
    color: #ffff;
    transition: color 300ms ease-in-out;
  }

  .count-text.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  .count-toggle {
    opacity: 0.5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 999px;
    color: #475569;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .count-toggle:hover {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
  }

  .count-toggle svg {
    width: 13px;
    height: 13px;
  }

  .select-mode-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    padding: 0;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    transition:
      border-color 250ms ease,
      color 250ms ease,
      background-color 250ms ease;
  }

  .select-mode-toggle svg {
    width: 14px;
    height: 14px;
  }

  .select-mode-toggle:hover {
    border-color: #475569;
    color: #e24e4e;
  }

  .select-mode-toggle.is-active {
    background: rgba(26, 27, 32, 0.562);
    border-color: rgba(129, 140, 248, 0.5);
    color: #cc7c7c;
    /* color: #a5b4fc; */
  }

  .bulk-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 16px;
    border-top: 1px solid #334155;
    background: rgba(99, 102, 241, 0.08);
    animation: bar-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bulk-count {
    font-size: 12px;
    font-weight: 600;
    color: #c7d2fe;
  }

  .bulk-actions {
    display: flex;
    gap: 8px;
  }

  .bulk-cancel,
  .bulk-delete {
    appearance: none;
    border-radius: 8px;
    padding: 5px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 140ms ease,
      filter 140ms ease,
      opacity 140ms ease;
  }

  .bulk-cancel {
    background: none;
    border: 1px solid #334155;
    color: #94a3b8;
  }

  .bulk-cancel:hover {
    border-color: #475569;
    color: #e2e8f0;
  }

  .bulk-delete {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, #7f1d1d, #450a0a);
    color: #f8fafc;
  }

  .bulk-delete:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .bulk-delete:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .bulk-delete:active:not(:disabled),
  .bulk-cancel:active {
    transform: scale(0.96);
  }

  @keyframes bar-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .bulk-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .select-all-btn {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 150ms ease;
  }

  .select-all-btn:hover {
    color: #a5b4fc;
  }
</style>
