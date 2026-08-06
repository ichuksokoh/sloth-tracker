<script lang="ts">
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface DescriptionDrawerProps {
    description: string;
    open: boolean;
    onToggle: (next: boolean) => void;
  }

  let { description, open, onToggle }: DescriptionDrawerProps = $props();

  function toggle() {
    onToggle(!open);
  }
</script>

<div class="drawer">
  <button class="drawer-trigger" class:is-open={open} onclick={toggle} aria-expanded={open}>
    <span>Description</span>
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
  {#if open}
    <div transition:slide={{ duration: 400, easing: cubicOut }} class="drawer-body" class:is-open={open}>
      <div class="drawer-content">
        <p>{description}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .drawer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .drawer-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    color: #acb1b8;
    cursor: pointer;
    background: transparent;
    border: none;
    transition: color 250ms ease-in-out;
  }

  .drawer-trigger:hover {
    color: #cbd5e1;
  }

  .chevron {
    width: 14px;
    height: 14px;
    transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .drawer-trigger.is-open .chevron {
    transform: rotate(180deg);
  }

  .drawer-body {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .drawer-body.is-open {
    grid-template-rows: 1fr;
  }

  .drawer-content {
    width: 100%;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 10px;
    min-width: 40%;
    min-height: 40px;
    padding: 10px 12px;
    color: #e8ebf0;
  }

  .drawer-content p {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: #cbd5e1;
    text-align: center;
  }
</style>
