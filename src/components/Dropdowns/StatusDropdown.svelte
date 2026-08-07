<script lang="ts">
  import type { ReadStatus } from "@/types";
  import { sineOut } from "svelte/easing";
  import { fly, slide } from "svelte/transition";
  interface StatusDropdownProps {
    options: ReadStatus[];
    onSelect: (status: ReadStatus) => void;
    currentSelection?: ReadStatus;
    textColor?: string;
    bgColor?: string;
  }

  let {
    options,
    onSelect,
    currentSelection = options.sort()[0],
    textColor = "#e2e8f0",
    bgColor = "#334155"
  }: StatusDropdownProps = $props();

  let open = $state(false);
  let panelEl = $state<HTMLElement | null>(null);
  let triggerEl = $state<HTMLElement | null>(null);

  let optionsUsed = $derived(options.toSorted());

  // --- color helpers: derive every interactive-state color from the
  // passed bgColor/textColor instead of hardcoding a fixed palette, so
  // the dropdown always reads as an extension of whichever status badge
  // opened it. ---
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    return {
      r: parseInt(full.slice(0, 2), 16) || 0,
      g: parseInt(full.slice(2, 4), 16) || 0,
      b: parseInt(full.slice(4, 6), 16) || 0
    };
  }

  function mix(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
    const { r, g, b } = hexToRgb(hex);
    const mr = Math.round(r + (target.r - r) * amount);
    const mg = Math.round(g + (target.g - g) * amount);
    const mb = Math.round(b + (target.b - b) * amount);
    return `rgb(${mr}, ${mg}, ${mb})`;
  }

  function lighten(hex: string, amount = 0.25): string {
    return mix(hex, { r: 255, g: 255, b: 255 }, amount);
  }

  function withAlpha(hex: string, alpha: number): string {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Row hover/active: same hue, different alpha steps instead of indigo.
  let rowHoverBg = $derived(withAlpha(lighten(bgColor, 0.15), 0.3));
  let rowActiveBg = $derived(withAlpha(lighten(bgColor, 0.1), 0.55));
  let scrollbarThumb = $derived(withAlpha(textColor, 0.3));

  function toggle(e: Event) {
    e.stopPropagation();
    open = !open;
  }

  function select(sortOptionIdx: number) {
    currentSelection = optionsUsed[sortOptionIdx];
    if (onSelect) onSelect(optionsUsed[sortOptionIdx]);
    open = false;
  }

  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (panelEl?.contains(target) || triggerEl?.contains(target)) return;
    open = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div
  class="picker"
  style="--row-hover: {rowHoverBg}; --row-active: {rowActiveBg}; --scrollbar-thumb: {scrollbarThumb};"
>
  <button
    bind:this={triggerEl}
    class="trigger"
    class:is-open={open}
    onclick={toggle}
    style="color: {textColor}; background: {bgColor}ea"
  >
    <span class="trigger-label">{currentSelection}</span>
  </button>

  {#if open}
    <div class="panel-position">
      <div
        bind:this={panelEl}
        transition:fly={{ duration: 250, delay: 0, easing: sineOut }}
        class="panel"
        style="background: {bgColor}ea; color: {textColor}"
      >
        {#each optionsUsed as option, index (index)}
          <button
            class="sort-row"
            class:is-active={optionsUsed[index] === currentSelection}
            onclick={(e: Event) => {
              e.stopPropagation();
              select(index);
            }}
            style="color: {textColor}"
          >
            <span>{option}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    display: inline-block;
    font-family: inherit;
    align-self: flex-start;
  }

  .trigger {
    /* Reset browser button defaults so this renders identically to the
       plain <span> status-badge in Card.svelte — buttons carry their own
       UA font, line-height, margin, and appearance that a span doesn't. */
    appearance: none;
    margin: 0;
    font: inherit;
    outline: none;
    padding: 2px 7px;
    border-radius: 999px;
    border: none;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.9;
    backdrop-filter: blur(1px);
    white-space: nowrap;
    cursor: pointer;
    min-width: 12px;
    min-height: 12px;
  }

  .trigger:focus-visible {
    outline: 2px solid var(--row-active);
    outline-offset: 2px;
  }

  .panel {
    opacity: 0.9;
    left: 50%;
    transform-origin: bottom center;
    max-height: 200px;
    overflow-y: auto;
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-shadow:
      0 8px 16px rgba(0, 0, 0, 0.35),
      0 2px 4px rgba(0, 0, 0, 0.25);
    padding: 6px;
    z-index: 50;
  }

  .panel-position {
    position: absolute;
    top: calc(100% + 2px);
    left: 50%;
    transform: translateX(-50%);
  }


  .panel::-webkit-scrollbar {
    width: 5px;
  }

  .panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 999px;
  }

  .sort-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    border-radius: 8px;
    font-size: 9px;
    text-align: center;
    cursor: pointer;
    transition: background-color 120ms ease;
    min-width: 0;
    gap: 8px;
  }

  .sort-row span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sort-row:hover {
    background: var(--row-hover);
  }

  .sort-row.is-active {
    background: var(--row-active);
    font-weight: 600;
  }
</style>
