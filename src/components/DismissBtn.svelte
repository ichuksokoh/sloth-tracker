<script lang="ts">
  let { onDismiss }: { onDismiss: () => void } = $props()
</script>

<button class="dismiss-btn" onclick={onDismiss} aria-label="Dismiss">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
</button>

<style>
  .dismiss-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 30px;
    height: 40px;
    padding: 0;
    margin-left: -1px; /* overlap the sibling's border so the seam disappears */
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-left: none;
    border-top-right-radius: 9999px;
    border-bottom-right-radius: 9999px;
    color: rgba(226, 232, 240, 0.6);
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }

  .dismiss-btn svg {
    width: 13px;
    height: 13px;
  }

  .dismiss-btn:hover {
    background: rgba(127, 29, 29, 0.55);
    color: #fca5a5;
  }

  .dismiss-btn:active {
    transform: scale(0.95);
  }
</style>