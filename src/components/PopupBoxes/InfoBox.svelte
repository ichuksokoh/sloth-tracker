<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface InfoBoxProps {
    open?: boolean;
    title?: string;
    children: Snippet;
    closeLabel?: string;
    secondaryLabel?: string;
    onClick?: (() => void) | (() => Promise<void>); // Function to be called when the secondary button is clicked
    showSecondary?: boolean;
  }

  let {
    open = $bindable(false),
    title,
    children,
    closeLabel = "Close",
    onClick,
    secondaryLabel = "Clear",
    showSecondary = false
  }: InfoBoxProps = $props();

  function close() {
    open = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  // Custom Svelte transition that mimics your exact panel-in/panel-out keyframes
  function panelPop(node: HTMLElement, { duration = 200 } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) => `
        opacity: ${t};
        transform: scale(${0.95 + 0.05 * t}) translateY(${8 * (1 - t)}px);
      `
    };
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- Added Svelte's built-in fade transition to the backdrop -->
  <div class="backdrop" transition:fade={{ duration: 150 }} onclick={handleBackdropClick} role="presentation">
    <!-- Added the custom panelPop transition to the panel -->
    <div
      class="panel"
      transition:panelPop
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "info-title" : undefined}
    >
      <!-- Top Right X Button -->
      <button class="top-close-btn" aria-label="Close" onclick={close}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {#if title}
        <h2 id="info-title">{title}</h2>
      {/if}

      <div class="content">
        {@render children()}
      </div>

      <!-- Bottom Close Button (HideButton Aesthetic) -->
      <div class="actions" class:not-showing-secondary={!(onClick && secondaryLabel && showSecondary)}>
        {#if onClick && secondaryLabel && showSecondary}
          <button class="secondary-btn" onclick={onClick}>
            {secondaryLabel}
          </button>
        {/if}
        <button class="btn-bottom-close" onclick={close}>
          {closeLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Removed all the @keyframes and .closed classes! */

  /* Base AlertBox Aesthetic */
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, rgba(103, 116, 172, 0.65) 0%, rgba(10, 2, 23, 0.85) 100%);
    backdrop-filter: blur(2px);
    z-index: 1000;
  }

  .panel {
    position: relative;
    width: min(90%, 320px);
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 18px;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .panel h2 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: #f8fafc;
    text-align: center;
  }

  .content {
    font-size: 13px;
    line-height: 1.6;
    color: #cbd5e1;
    margin-top: 4px;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
  }

  .actions.not-showing-secondary {
    justify-content: flex-end;
  }

  /* Top Right X Button */
  .top-close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #64748b;
    border-radius: 6px;
    padding: 4px;
    cursor: pointer;
    transition:
      color 150ms ease,
      background-color 150ms ease;
  }

  .top-close-btn:hover {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
  }

  .top-close-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Bottom Close Button (HideButton Aesthetic) */
  .btn-bottom-close {
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 16px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    color: #64748b;
    transition:
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .btn-bottom-close:hover {
    border-color: #475569;
    color: #94a3b8;
  }

  .btn-bottom-close:active {
    transform: scale(0.96);
  }

  .secondary-btn {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 150ms ease;
  }
</style>
