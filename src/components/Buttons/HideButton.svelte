<script lang="ts">
  interface HideButtonProps {
    hidden?: boolean;
    onToggle?: (next: boolean) => void;
    forStatus?: boolean;
    size?: number;
    isCard?: boolean;
    bgLuminance?: number; // 0 (dark bg) - 1 (light bg)
  }

  let {
    hidden = $bindable(false),
    onToggle,
    forStatus = false,
    size = 34,
    isCard = false,
    bgLuminance = 1
  }: HideButtonProps = $props();

  function handleClick(e: Event) {
    e.stopPropagation();
    hidden = !hidden;
    onToggle?.(hidden);
  }

  let ariaLabel = $derived(
    hidden ? (forStatus ? "Showing hidden only" : "Unhide") : forStatus ? "Show hidden only" : "Hide"
  );

  let onLightBg = $derived(bgLuminance > 0.55);
</script>

<button
  class="hide-btn"
  class:is-active={hidden}
  class:is-card={isCard}
  class:is-on-light={onLightBg}
  onclick={handleClick}
  aria-pressed={hidden}
  aria-label={ariaLabel}
  style="--size: {size}px"
>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if hidden}
      <path
        d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.28 20.28 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"
      />
      <line x1="2" y1="2" x2="22" y2="22" />
    {:else}
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    {/if}
  </svg>
</button>

<style>
  .hide-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: var(--size);
    max-height: var(--size);
    height: var(--size);
    width: 100%;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    color: #64748b;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .hide-btn svg {
    width: 16px;
    height: 16px;
  }

  .hide-btn:hover {
    border-color: #475569;
    color: #dbdfe6;
  }

  .hide-btn.is-active {
    color: #dbdfe6;
    border-color: rgba(129, 140, 248, 0.4);
    background: rgba(99, 102, 241, 0.12);
    animation: pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .hide-btn.is-active:hover {
    color: #c7d2fe;
  }

  .hide-btn:active {
    transform: scale(0.9);
  }

  /* ---- card variant (dark cover assumed by default) ---- */
  .hide-btn.is-card {
    appearance: none;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    background: rgba(15, 23, 42, 0.527);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    color: #cbd5e1;
    transition:
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 250ms ease,
      border-color 250ms ease,
      color 250ms ease,
      rotate 250ms ease;
  }

  .hide-btn.is-card svg {
    width: 12px;
    height: 12px;
  }

  .hide-btn.is-card.is-active {
    color: #d3d5dc;
    border-color: rgba(129, 140, 248, 0.4);
    background: rgba(99, 101, 241, 0.527);
    animation: pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ---- card variant on a light cover ---- */
  .hide-btn.is-card.is-on-light:not(.is-active) {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(100, 116, 139, 0.25);
    color: #334155;
  }

  .hide-btn.is-card.is-on-light:not(.is-active):hover {
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(71, 85, 105, 0.35);
    color: #1e293b;
  }

  .hide-btn.is-card.is-on-light.is-active {
    background: rgba(79, 70, 229, 0.18);
    border-color: rgba(79, 70, 229, 0.45);
    color: #4338ca;
  }

  .hide-btn.is-card.is-on-light.is-active:hover {
    background: rgba(79, 70, 229, 0.26);
    color: #3730a3;
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
