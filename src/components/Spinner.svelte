<script lang="ts">
  interface SpinnerProps {
    size?: number;
    color1?: string;
    color2?: string;
    color3?: string;
    active: boolean;
    timing?: number;
  }

  let {
    size = 24,
    color1 = "#e8e1f0",
    color2 = "#C79CEC",
    color3 = "#CAC7F0",
    active = $bindable(false),
    timing = 1.5
  }: SpinnerProps = $props();
</script>

{#if active}
  <div
    class="spinner-container"
    style="--spinner-size: {size}px; --spinner-color1: {color1}; --spinner-color2: {color2}; --spinner-color3: {color3}; --spinner-timing: {timing}s;"
  >
    <div class="spinner"></div>
  </div>
{/if}

<style>
  .spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%; /* Better than hardcoding 45px, which was overflowing your 40px App.svelte button */
    background: transparent;
  }

  .spinner {
    width: var(--spinner-size);
    height: var(--spinner-size);
    border-radius: 50%;

    /* Conic gradient gives the fading "tail" effect */
    background: conic-gradient(transparent 0deg, var(--spinner-color2) 180deg, var(--spinner-color3) 360deg);

    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px));

    animation: spin var(--spinner-timing) linear infinite; /* linear usually looks better for comet tails */
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
