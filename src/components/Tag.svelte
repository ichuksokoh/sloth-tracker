<script lang="ts">
  interface TagProps {
    text: string;
    colorFrom?: string;
    colorTo?: string;
    onClick?: () => void;
    filtered?: boolean;
    filterControl?: boolean;
  }

  let {
    text,
    colorFrom = "#1e293b",
    colorTo = "#334155",
    onClick,
    filtered = false,
    filterControl = false
  }: TagProps = $props();
  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    if (onClick) {
      onClick();
    }
  }
</script>

<button class="tag" onclick={handleClick} class:is-filtered={filtered || filterControl}>
  {text}
  <!-- {#if filtered}
    <svg
      class="tag-filtered-icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2.5"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  {/if} -->
  {#if filtered}
    <div class="tag-filtered-close-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  {/if}
</button>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    height: 34px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    color: #a2b0c4;
    cursor: pointer;
    /* background: #1e293b; */
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border: 1px solid #334155;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      color 200ms ease;
  }

  .tag:active:hover {
    transform: scale(0.9) translateY(1px);
    border-color: #475569;
    color: #e8ebf0;
  }

  .tag:hover {
    transform: scale(1) translateY(-4px);
    border-color: #475569;
    color: #e8ebf0;
  }

  .tag.is-filtered {
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border-color: #818cf8;
    color: #e8ebf0;
  }

  .tag-filtered-close-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: transparent;
    color: #e8ebf0;
  }
</style>
