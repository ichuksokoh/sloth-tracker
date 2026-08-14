<script lang="ts">
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { toastStore } from "@/lib/toastStore.svelte";

  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  $effect(() => {
    const activeIds = new Set(toastStore.toasts.map((t) => t.id));

    // Start a timer for any toast that doesn't have one yet
    for (const t of toastStore.toasts) {
      if (!timers.has(t.id)) {
        timers.set(
          t.id,
          setTimeout(() => toastStore.dismiss(t.id), t.duration)
        );
      }
    }

    // Clear timers for toasts that are no longer in the store
    // (dismissed by timeout, by click, or by the effect below on unmount)
    for (const [id, timer] of timers) {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }

    // Component teardown — clear everything still pending
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  });

  function dismiss(id: number) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    toastStore.dismiss(id);
  }
</script>

<div class="toast-container">
  {#each toastStore.toasts as t (t.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="toast"
      role="status"
      onclick={() => dismiss(t.id)}
      transition:fly={{ y: 16, duration: 250 }}
      animate:flip={{ duration: 250 }}
    >
      {t.message}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 1100;
    pointer-events: none;
  }

  .toast {
    padding: 10px 14px;
    border-radius: 10px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    max-width: 300px;
    pointer-events: auto;
  }

  .toast:hover {
    border-color: #475569;
  }
</style>