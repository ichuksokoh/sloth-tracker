<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  interface RatingBarProps {
    rating?: number | null;
    onSelect?: (value: number) => void;
    onClear?: () => void;
  }
  let { rating = $bindable(undefined), onSelect, onClear }: RatingBarProps = $props();

  const MIN = 0;
  const MAX = 10;
  const STEP = 0.25;
  const CLEAR_ANIM_MS = 550; // matches the width/left transition duration below

  let trackEl = $state<HTMLElement | null>(null);
  let dragging = $state(false);
  let inputValue = $state("");

  let hasSelection = $derived(rating !== undefined && rating !== null);
  let percent = $derived(hasSelection ? ((rating! - MIN) / (MAX - MIN)) * 100 : 0);

  // Visual state, decoupled from `rating` so the clear button can animate
  // the fill/thumb to 0 before they actually unmount.
  let displayPercent = $state(0);
  let showTrack = $state(false);
  let clearing = $state(false);

  $effect(() => {
    // Only re-sync while there IS a selection. This intentionally does NOT
    // react to hasSelection turning false, so handleClear's manual
    // sequencing (animate, then unmount) isn't immediately overwritten.
    if (hasSelection) {
      displayPercent = percent;
      showTrack = true;
    } else if (!clearing) {
      displayPercent = 0;
      showTrack = false;
    }
  });

  $effect(() => {
    inputValue = hasSelection ? String(rating) : "";
  });

  function clampAndStep(value: number, fromInput = false): number {
    const stepped = fromInput ? Math.round(value * 100) / 100 : Math.round(value / STEP) * STEP;
    return Math.min(MAX, Math.max(MIN, Math.round(stepped * 100) / 100));
  }

  function commit(value: number, { live = false } = {}, fromInput = false) {
    const clamped = clampAndStep(value, fromInput);
    rating = clamped;
    if (!live) {
      onSelect?.(clamped);
    }
  }

  function handleInputChange(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value;
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      commit(parsed, {}, true);
    } else {
      inputValue = hasSelection ? String(rating) : "";
    }
  }

  function valueFromClientX(clientX: number): number {
    if (!trackEl) return MIN;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return MIN + ratio * (MAX - MIN);
  }

  function handlePointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    commit(valueFromClientX(e.clientX), { live: true });
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragging) return;
    commit(valueFromClientX(e.clientX), { live: true });
  }

  function handlePointerUp(e: PointerEvent) {
    dragging = false;
    onSelect?.(rating!); // commit the final value exactly once, now that dragging has stopped
  }

  function handleClear() {
    clearing = true;
    // Kick off the visual animation immediately...
    displayPercent = 0;
    // ...then unmount and notify the parent once the transition has finished.
    setTimeout(() => {
      showTrack = false;
      onClear?.();
      clearing = false;
    }, CLEAR_ANIM_MS);
  }
</script>

<div class="rating-wrap">
  <div class="rating-header">
    <span class="rating-label">
      Rating:
      <input
        type="number"
        class="rating-input"
        min={MIN}
        max={MAX}
        step={STEP}
        placeholder="—"
        value={inputValue}
        onchange={handleInputChange}
      />
      {#if hasSelection}
        <button
          transition:fade={{ duration: 300, delay: 0, easing: cubicOut }}
          class="clear-btn"
          onclick={handleClear}
          aria-label="Clear"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}
    </span>
    <span class="rating-value" class:is-empty={!hasSelection}>
      {hasSelection ? rating!.toFixed(2) : "—"}
    </span>
  </div>

  <button
    bind:this={trackEl}
    class="rating-track"
    class:is-dragging={dragging}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    aria-label="Rating"
  >
    <div class="rating-track-inner" class:is-dragging={dragging}>
      {#if showTrack}
        <div
          transition:fade={{ duration: 350, delay: 0, easing: cubicOut }}
          class="rating-fill"
          style="width: {displayPercent}%"
        ></div>
        <div
          transition:fade={{ duration: 350, delay: 0, easing: cubicOut }}
          class="rating-thumb"
          class:is-dragging={dragging}
          style="left: {displayPercent}%"
        ></div>
      {/if}
    </div>
  </button>
</div>

<style>
  .rating-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rating-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .rating-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
  }

  .rating-input {
    width: 42px;
    padding: 2px 4px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 12px;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .rating-input:focus {
    outline: none;
    border-color: #818cf8;
  }

  .rating-input::-webkit-inner-spin-button,
  .rating-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 9999px;
    color: rgba(226, 232, 240, 0.6);
    cursor: pointer;
    opacity: 0%;
    transition:
      background-color 150ms ease,
      transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 350ms ease,
      color 150ms ease;
  }

  .clear-btn svg {
    width: 12px;
    height: 12px;
  }

  /* Reveal on hovering the label row, not just the button itself */
  .rating-label:hover .clear-btn {
    opacity: 100%;
  }

  .clear-btn:hover {
    transform: rotate(360deg);
    background: rgba(127, 29, 29, 0.55);
    color: #fca5a5;
  }

  .clear-btn:active {
    transform: scale(0.9);
  }

  .rating-value {
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #818cf8;
  }

  .rating-value.is-empty {
    color: #64748b;
  }

  .rating-track {
    position: relative;
    width: 100%;
    height: 8px;
    padding: 0;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 999px;
    cursor: pointer;
    touch-action: none;
  }

  .rating-fill {
    position: absolute;
    top: -1px;
    bottom: -1px;
    left: -1px;
    background: linear-gradient(90deg, #6366f1, #818cf8);
    border-radius: 999px;
    box-shadow: 0 0 8px rgba(129, 140, 248, 0.5);
    transition: width 500ms ease;
  }

  .rating-track.is-dragging .rating-fill {
    transition: none;
  }

  .rating-thumb {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #6366f1;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition:
      left 500ms ease,
      transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .rating-thumb.is-dragging {
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
    transform: translate(-50%, -50%) scale(1.25);
  }
</style>
