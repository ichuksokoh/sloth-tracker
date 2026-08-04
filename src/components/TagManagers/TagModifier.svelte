<script lang="ts">
  interface TagModifierProps {
    text: string;
    colorFrom?: string;
    colorTo?: string;
    onClick?: () => void;
    toAdd?: boolean;
    toRemove?: boolean;
  }

  let {
    text,
    colorFrom = "#1e293b",
    colorTo = "#334155",
    onClick,
    toAdd = false,
    toRemove = false
  }: TagModifierProps = $props();
  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    if (onClick) {
      onClick();
    }
  }
</script>

<button class="tag" onclick={handleClick} class:to-add={toAdd}>
  {text}
  <div class="edit-icon" class:to-add={toAdd}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </div>
</button>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    /* justify-content: center; */
    gap: 4px;
    padding: 2px 8px;
    height: 34px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    color: #e8ebf0;
    cursor: pointer;
    /* background: #1e293b; */
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border: 1px solid;
    border-color: #818cf8;
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
    /* border-color: #475569; */
    color: #e8ebf0;
  }

  .tag.to-add:hover {
    color: #e8ebf0;
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border: 1px solid;
    border-color: #818cf8;
  }

  .tag.to-add {
    background: linear-gradient(-90deg, #8d8cc1, 0%, #5957a1 50%, #4a118a 100%);
    border-color: #334155;
    color: #a2b0c4;
  }

  .edit-icon {
    background: transparent;
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: none;
    /* rotate: 45deg; */
    transition:
      rotate 450ms ease-out,
      transform 200ms ease-in-out;
  }

  .edit-icon.to-add {
    rotate: 405deg;
  }
</style>
