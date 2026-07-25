<script lang="ts">
  import type { SortDirection } from "@/types";

  interface SortByDirBtnProps {
    direction: SortDirection;
    onClick: () => void;
    size?: number;
  }
  let { direction, onClick, size = 34 }: SortByDirBtnProps = $props();
</script>

<div>
  <button class="sort-btn" onclick={onClick} style={`--size: ${size}px`}>
    {#if direction === "asc"}
      <svg
        class="sort-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    {:else}
      <svg
        class="sort-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    {/if}
  </button>
</div>

<style>
  .sort-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: var(--size);
    max-height: var(--size);
    height: var(--size);
    width: 100%;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .sort-btn svg {
    width: 16px;
    height: 16px;
  }

  .sort-btn:hover {
    border-color: #475569;
    color: #dbdfe6;
  }

  .sort-btn:active {
    transform: scale(0.9);
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
