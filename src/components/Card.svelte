<script lang="ts">
  import type { Manhwa, ReadStatus } from "@/types";
  import { retrieveCover } from "@/lib/coverCache.svelte";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import AlertBox from "@/components/PopupBoxes/AlertBox.svelte";
  import ProgressBar from "@/components/ProgressBar.svelte";
  import StatusDropdown from "./Dropdowns/StatusDropdown.svelte";
  import ChapterOverlay from "./Dropdowns/ChapterOverlay.svelte";
  import FavoriteButton from "./Buttons/FavoriteButton.svelte";
  import HideButton from "./Buttons/HideButton.svelte";
  import { sampleRegionLuminance } from "@/lib/imageBrightness";

  interface CardProps {
    manhwa: Manhwa;
    onClick: (manhwa: Manhwa) => void;
    maxWidth?: string;
    maxHeight?: string;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: (manhwa: Manhwa) => void;
  }

  let {
    manhwa,
    onClick,
    maxWidth = "100%",
    maxHeight = "100%",
    selectMode = false,
    selected = false,
    onToggleSelect
  }: CardProps = $props();

  const cover = retrieveCover(() => manhwa);

  let chapterPickerOpen = $state(false);

  function handleChapterTriggerClick(e: MouseEvent) {
    if (selectMode) return; // let the click bubble to the card's own select-toggle handler
    e.stopPropagation(); // don't trigger the card's "open side panel" click
    chapterPickerOpen = !chapterPickerOpen;
  }

  function handleChapterSelect(chapterNumber: number) {
    if (manhwa) {
      let falsePrior = true;
      const chapters = manhwa.chapters.map((chp) => {
        if (chp.number <= chapterNumber) {
          if (chp.number === chapterNumber && chp.read) {
            falsePrior = false;
          }
          return { ...chp, read: true };
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
      manhwaStore.update(manhwa.id, {
        currentChapter: chapterNumber,
        status: setToPlan ? "Plan To Read" : "Reading",
        startedOn: manhwa.startedOn ?? Date.now(),
        chapters: finalChapters,
        completedOn: null // Clear the completedOn date when marking as reading
      });
    }
  }

  function handleStatusSelect(newStatus: ReadStatus) {
    if (newStatus === "Completed") {
      const updatedChapters = manhwa.chapters.map((chp) => {
        return { ...chp, read: true };
      });
      const newCurrentChapter = manhwa.totalChapters;
      manhwaStore.update(manhwa.id, {
        currentChapter: newCurrentChapter,
        status: newStatus,
        completedOn: Date.now(),
        chapters: updatedChapters
      });
    } else if (newStatus === "Plan To Read") {
      const updatedChapters = manhwa.chapters.map((chp) => {
        return { ...chp, read: false };
      });
      manhwaStore.update(manhwa.id, {
        currentChapter: 1,
        status: newStatus,
        chapters: updatedChapters
      });
    } else {
      manhwaStore.update(manhwa.id, { status: newStatus, completedOn: null });
    }
    manhwaStore.update(manhwa.id, { status: newStatus });
  }

  function checkOverflow(node: HTMLElement) {
    const resizeObserver = new ResizeObserver(() => {
      const span = node.querySelector(".title-main") as HTMLElement;
      if (!span) return;
      if (span.scrollWidth > node.clientWidth) {
        node.classList.add("is-overflowing");
      } else {
        node.classList.remove("is-overflowing");
      }
    });
    resizeObserver.observe(node);
    return {
      destroy() {
        resizeObserver.disconnect();
      }
    };
  }

  function getContrastTextColor(hex: string): "#000000" | "#ffffff" {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
  }

  const statusColors: Record<string, string> = {
    Reading: "#4338ca",
    "Plan To Read": "#334155",
    Completed: "#0f766e",
    Dropped: "#7f1d1d",
    "On Hold": "#a16207"
  };

  let badgeBg = $derived(statusColors[manhwa.status] ?? "#334155");
  let badgeText = $derived(getContrastTextColor(badgeBg));

  let isLandscape = $state(false);
  let coverLuminance = $state(1);

  function handleImageLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    isLandscape = img.naturalWidth > img.naturalHeight;

    // top-left corner, best sample
    coverLuminance = sampleRegionLuminance(img, { xFrac: 0, yFrac: 0, wFrac: 0.25, hFrac: 0.18 });
  }

  function handleToggleFavorite(e: MouseEvent) {
    e.stopPropagation();
    manhwaStore.update(manhwa.id, { favorite: !manhwa.favorite });
  }

  function handleToggleFav() {
    manhwaStore.update(manhwa.id, { favorite: !manhwa.favorite });
  }
  function handleToggleHidden() {
    manhwaStore.update(manhwa.id, { hidden: !manhwa.hidden });
  }

  let showDeleteConfirm = $state(false);
  async function deleteManhwa(id: string) {
    if (!id || id === "") return;
    await manhwaStore.remove(id);
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    showDeleteConfirm = true;
  }

  function handleCardClick() {
    if (selectMode) {
      onToggleSelect?.(manhwa);
    } else {
      onClick(manhwa);
    }
  }
</script>

<AlertBox
  bind:open={showDeleteConfirm}
  title="Delete manhwa?"
  confirmLabel="Delete"
  confirmColorFrom="#7f1d1d"
  confirmColorTo="#450a0a"
  onConfirm={() => deleteManhwa(manhwa.id ?? "")}
>
  This will remove <strong>{manhwa.title}</strong> from your library. This can't be undone.
</AlertBox>
<div
  class="card"
  role="button"
  tabindex="0"
  onclick={() => handleCardClick()}
  onkeydown={(e) => e.key === "Enter" && onClick(manhwa)}
  style="max-width: {maxWidth}; max-height: {maxHeight};"
>
  <div class="cover-wrap">
    {#if manhwa.coverUrl}
      <img
        src={cover.url}
        alt={manhwa.title}
        loading="lazy"
        onload={handleImageLoad}
        class:is-landscape={isLandscape}
      />
    {:else}
      <div class="cover-placeholder">?</div>
    {/if}

    {#if selectMode}
      <div class="select-overlay" class:is-selected={selected}>
        <div class="select-check">
          {#if selected}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          {/if}
        </div>
      </div>
    {:else}
      <div class="overlay-controls">
        <div class="favorite-btn-wrapper">
          <FavoriteButton
            favorite={manhwa.favorite}
            onToggle={handleToggleFav}
            isCard={true}
            bgLuminance={coverLuminance}
          />
        </div>
        <div class="status-dropdown-wrapper">
          <StatusDropdown
            currentSelection={manhwa.status}
            options={["Reading", "Plan To Read", "Completed", "Dropped", "On Hold"]}
            onSelect={handleStatusSelect}
            bgColor={badgeBg}
            textColor={badgeText}
          />
        </div>
        <button class="delete-btn" onclick={handleDelete} aria-label="Delete manhwa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="rating">
        <span>{manhwa.rating?.toFixed(2)}</span>
      </div>
      <div class="hide-btn-wrapper">
        <HideButton
          hidden={manhwa.hidden}
          onToggle={handleToggleHidden}
          isCard={true}
          bgLuminance={coverLuminance}
        />
      </div>
    {/if}
    <ChapterOverlay {manhwa} bind:open={chapterPickerOpen} onSelect={handleChapterSelect} />
  </div>
  <button class="chapter-trigger" onclick={handleChapterTriggerClick} aria-label="Select chapter">
    <ProgressBar {manhwa} isCard={true} />
    <div class="title-wrap" use:checkOverflow>
      <div class="marquee-content">
        <span class="title-main">{manhwa.title}</span>
        <span class="title-duplicate" aria-hidden="true">{manhwa.title}</span>
      </div>
    </div>
  </button>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    text-align: left;
    max-width: var(--max-width);
    max-height: var(--max-height);
    min-width: 0;
  }

  .cover-wrap {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: 10px;
    overflow: hidden;
    background: #1e293b;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.25);
    transition:
      transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 200ms ease;
  }

  .card:hover .cover-wrap {
    transform: translateY(-4px) scale(1.04);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 12px 24px rgba(99, 102, 241, 0.25);
  }

  .cover-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #0f172a;
  }

  .cover-wrap img.is-landscape {
    object-fit: contain;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 24px;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    color: #cbd5e1;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.85);
    transition:
      opacity 250ms ease,
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 250ms ease,
      color 250ms ease,
      rotate 250ms ease;
  }

  .card:hover .delete-btn {
    opacity: 1;
    transform: scale(1);
  }

  .delete-btn svg {
    width: 12px;
    height: 12px;
  }


  .delete-btn:hover {
    background: rgba(122, 15, 15, 0.497);
    border-color: rgba(248, 113, 113, 0.4);
    color: #f87171;
    rotate: 90deg;
  }

  .title-wrap {
    min-width: 0;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
    mask-image: linear-gradient(to right, transparent, black 3%, black 95%, transparent);
  }

  .marquee-content {
    display: flex;
    width: max-content;
    padding-right: 24px;
    gap: 24px;
  }

  .title-wrap span {
    font-size: 12px;
    font-weight: 500;
    color: #cbd5e1;
  }

  .title-duplicate {
    display: none;
  }

  .title-wrap:global(.is-overflowing) .title-duplicate {
    display: inline-block;
  }

  .card:hover .title-wrap:global(.is-overflowing) .marquee-content {
    animation: scroll-left 7s linear infinite;
  }

  @keyframes scroll-left {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  .overlay-controls {
    position: absolute;
    top: 6px;
    left: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .status-dropdown-wrapper {
    opacity: 0;
    transform: scale(0.85);
  }

  .card:hover {
    .status-dropdown-wrapper,
    .hide-btn-wrapper,
    .favorite-btn-wrapper {
      opacity: 1;
      transform: scale(1);
    }
  }

  .rating {
    position: absolute;
    bottom: 6px;
    left: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    font-size: 10px;
    font-weight: 600;
    color: #818cf8;
  }

  .favorite-btn-wrapper {
    opacity: 0;
    transform: scale(0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      opacity 10ms ease,
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }


  .hide-btn-wrapper {
    opacity: 0;
    transform: scale(0.85);
    position: absolute;
    bottom: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      opacity 10ms ease,
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }


  .select-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 6px;
    background: rgba(15, 23, 42, 0.15);
  }

  .select-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: rgba(15, 23, 42, 0.75);
    border: 1.5px solid rgba(148, 163, 184, 0.4);
    border-radius: 999px;
    color: #fff;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .select-overlay.is-selected .select-check {
    background: #6366f1;
    border-color: #818cf8;
    transform: scale(1.1);
  }

  .select-check svg {
    width: 12px;
    height: 12px;
  }

  .chapter-trigger {
    appearance: none;
    display: flex;
    flex-direction: column;
    gap: 6px; /* matches the .card gap it used to inherit as a direct child */
    width: 100%;
    padding: 0;
    margin: 0;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
</style>
