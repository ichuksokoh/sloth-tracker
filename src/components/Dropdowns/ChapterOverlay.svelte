<script lang="ts">
  import type { Manhwa } from "@/types";
  import { tick } from "svelte";
  import { sineOut } from "svelte/easing";
  import { fly, slide } from "svelte/transition";

  let {
    manhwa,
    open = $bindable(false),
    onSelect
  }: {
    manhwa: Manhwa;
    open?: boolean;
    onSelect: (chapterNumber: number) => void;
  } = $props();

  let panelEl = $state<HTMLElement | null>(null);

  function select(e: MouseEvent, chapterNumber: number) {
    e.stopPropagation(); // don't let this reach the card's own onclick
    onSelect(chapterNumber);
    open = false;
  }

  // Close on any click outside the panel. The trigger button in Card.svelte
  // stops propagation on the click that OPENS this panel, so that same
  // click never reaches this listener — only genuine "click elsewhere" does.
  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (panelEl?.contains(target)) return;
    open = false;
  }

  $effect(() => {
    if (open && panelEl) {
      const activeEl = panelEl.querySelector(".chapter-row.is-active") as HTMLElement | null;
      if (activeEl) {
        tick().then(() => {
          if (!panelEl) return;
          const activeEl = panelEl.querySelector(".chapter-row.is-active") as HTMLElement | null;

          if (activeEl) {
            // 1. Get the exact position relative to the scrollable container top
            const offsetWithinPanel = activeEl.offsetTop;

            // 2. To center it vertically, subtract half the panel's view height
            // and add back half the row's height
            const targetScrollTop = offsetWithinPanel - panelEl.clientHeight / 2 + activeEl.clientHeight / 2;

            // 3. Apply the scroll strictly to the panel element
            panelEl.scrollTop = Math.max(0, targetScrollTop);
          }
        });
      }
    }
  });
</script>

<svelte:window onclick={handleWindowClick} />

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    bind:this={panelEl}
    transition:fly={{ duration: 250, y: 200, delay: 0, easing: sineOut }}
    class="chapter-overlay"
    role="listbox"
    onclick={(e) => e.stopPropagation()}
  >
    {#each manhwa.chapters as chapter (chapter.number)}
      <button
        class="chapter-row"
        class:is-active={chapter.number === manhwa.currentChapter}
        onclick={(e) => select(e, chapter.number)}
      >
        <span class="chapter-label">{chapter.label}</span>
        {#if chapter.read}
          <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .chapter-overlay {
    position: absolute;
    border-radius: 10px;
    inset: 0;
    /* inset: 3px; */
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    padding: 7px 3px;
    /* Lower opacity + lighter blur than the other panels so the cover
       stays visible underneath, per the request. */
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    /* animation: overlay-in 180ms ease; */
  }

  @keyframes overlay-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .chapter-overlay::-webkit-scrollbar {
    width: 2px;
    /* display:none; */
  }
  .chapter-overlay::-webkit-scrollbar-track {
    padding: 3px 0px 0px 3px;
    background: transparent;
    width: 1px;
  }
  .chapter-overlay::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.4);
    border-radius: 999px;
  }

  .chapter-row {
    display: flex;
    align-items: center;
    width: 100%;
    flex-shrink: 0;
    padding: 6px 8px;
    background: rgba(15, 23, 42, 0.4);
    border: none;
    border-radius: 6px;
    color: #e2e8f0;
    font: inherit;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    transition: background-color 120ms ease;
    min-width: 0;
    gap: 6px;
  }

  .chapter-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis; /* long labels ellipse to the card's width */
    white-space: nowrap;
  }

  .chapter-row:hover {
    background: rgba(99, 102, 241, 0.35);
  }

  .chapter-row.is-active {
    background: rgba(99, 102, 241, 0.5);
    color: #fff;
    font-weight: 600;
  }

  .check {
    width: 12px;
    height: 12px;
    color: #a5b4fc;
    flex-shrink: 0;
  }
</style>
