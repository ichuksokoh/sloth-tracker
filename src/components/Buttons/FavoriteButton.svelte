<script lang="ts">
  interface FavoriteButtonProps {
    favorite: boolean;
    onToggle: () => void;
    forStatus?: boolean;
    size?: number;
    isCard?: boolean;
    bgLuminance?: number; // 0 (dark bg) - 1 (light bg)
  }
  let {
    favorite = $bindable(false),
    onToggle,
    forStatus = false,
    size = 34,
    isCard = false,
    bgLuminance = 1
  }: FavoriteButtonProps = $props();

  let onLightBg = $derived(bgLuminance > 0.55);


</script>

<button
  class="favorite-btn"
  class:is-active={favorite}
  class:is-card={isCard}
  class:is-on-light={onLightBg}
  onclick={(e: Event) => {
    e.stopPropagation();
    onToggle();
  }}
  aria-pressed={favorite}
  aria-label={favorite
    ? forStatus
      ? "Showing Favorites"
      : "Remove from favorites"
    : forStatus
      ? "Show Favorites"
      : "Add to favorites"}
  style="--size: {size}px"
>
  <svg viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" stroke-width="2">
    <polygon
      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
    />
  </svg>
</button>

<style>
  .favorite-btn {
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

  .favorite-btn svg {
    width: 17px;
    height: 17px;
  }

  .favorite-btn:hover {
    border-color: #475569;
    color: #dbdfe6;
  }

  .favorite-btn.is-active {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.4);
    background: rgba(251, 191, 36, 0.1);
    animation: pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .favorite-btn.is-active:hover {
    color: #fcd34d;
  }

  .favorite-btn:active {
    transform: scale(0.9);
  }

  /* ---- card variant (dark cover assumed by default) ---- */
  .favorite-btn.is-card {
    appearance: none;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid transparent;
    border-radius: 999px;
    color: #cbd5e1;
    transition:
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 250ms ease,
      border-color 250ms ease,
      color 250ms ease;
  }

  .favorite-btn.is-card svg {
    width: 12px;
    height: 12px;
  }

  .favorite-btn.is-card:hover {
    background: rgba(100, 72, 3, 0.671);
    border-color: rgba(193, 178, 91, 0.736);
    color: #fcd34d;
  }

  .favorite-btn.is-card.is-active {
    color: #e6aa12cf;
    border-color: rgba(251, 191, 36, 0.4);
    background: rgba(251, 191, 36, 0.15);
  }

  .favorite-btn.is-card.is-active:hover {
    color: #fcd34d;
    background: rgba(251, 191, 36, 0.22);
  }

  /* ---- card variant on a light cover ---- */
  .favorite-btn.is-card.is-on-light:not(.is-active) {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(100, 116, 139, 0.25);
    color: #334155;
  }

  .favorite-btn.is-card.is-on-light:not(.is-active):hover {
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(180, 130, 20, 0.35);
    color: #b45309;
  }

  .favorite-btn.is-card.is-on-light.is-active {
    background: rgba(180, 83, 9, 0.15);
    border-color: rgba(180, 83, 9, 0.4);
    color: #b45309;
  }

  .favorite-btn.is-card.is-on-light.is-active:hover {
    background: rgba(180, 83, 9, 0.22);
    color: #92400e;
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
