<script lang="ts">
  import type { Manhwa } from "@/types";
  import { Spring } from "svelte/motion";

  interface ProgressBarProps {
    manhwa: Manhwa;
    isCard?: boolean;
  }

  let { manhwa, isCard = false }: ProgressBarProps = $props();
  const round = (num: number, decimals: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  };
  let total = $derived(manhwa.totalChapters ?? manhwa.chapters.length);
  let current = $derived(manhwa.currentChapter);
  let currentLabel = $derived(manhwa.chapters.find((c) => c.number === current)?.label ?? `Ch. ${current}`);
  let totalLabel = $derived(
    manhwa.totalChapters ? (manhwa.chapters.find((c) => c.number === total)?.label ?? `Ch. ${total}`) : undefined
  );
  let percent = $derived(
    total && total > 0 && manhwa.chapters.filter((c) => c.read).length > 0
      ? Math.min(100, round((current / total) * 100, 1))
      : 0
  );

  // Leave for later as a setting option if user doens't want to animate on each open
  // let initialized = $state(false);

  const progress = new Spring(0, {
    stiffness: 0.08,
    damping: 0.6
  });

  $effect(() => {
    progress.target = percent;
    // if (!initialized) {
    //   progress.set(percent, {instant: true});
    //   initialized = true;
    // } else {
    //   progress.target = percent;
    // }
  });
</script>

<div class="progress-wrap">
  <div class="progress-header">
    {#if !isCard}
      <span class="progress-label">
        {#if total}
          {currentLabel} of {totalLabel}
        {:else}
          {currentLabel}
        {/if}
      </span>
      {#if total}
        <span class="progress-percent">{percent}%</span>
      {/if}
    {/if}
  </div>

  <div class="progress-track" class:card={isCard}>
    <div class="progress-fill" style="width: {progress.current}%"></div>
  </div>
</div>

<style>
  .progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .progress-label {
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
  }

  .progress-percent {
    font-size: 11px;
    font-weight: 600;
    color: #818cf8;
  }

  .progress-track {
    position: relative;
    width: 100%;
    height: 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-track.card {
    height: 1.25px;
  }

  .progress-fill {
    will-change: width;
    contain: layout paint;
    height: 100%;
    background: linear-gradient(90deg, #27299b 0%, #4f46e5 50%, #818cf8 100%);
    border-radius: 999px;
    box-shadow: 0 0 8px rgba(129, 140, 248, 0.5);
  }
</style>
