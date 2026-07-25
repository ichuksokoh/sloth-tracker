<script lang="ts">
  interface TaagProps {
    text: string;
    colorFrom?: string;
    colorTo?: string;
    onClick?: () => void;
  }

  let { text, colorFrom = "#1e293b", colorTo = "#334155", onClick }: TaagProps = $props();
  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    if (onClick) {
      onClick();
    }
  }
  
</script>

<button class="tag" onclick={handleClick}>
  {text}
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
    transition: transform 200ms ease, border-color 200ms ease, color 200ms ease;
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
</style>
