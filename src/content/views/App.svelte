<script lang="ts">
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import AlertBox from "@/components/PopupBoxes/AlertBox.svelte";
  import ViewLib from "@/content/views/ViewLib.svelte";
  import { scrapeCurrentPage } from "@/lib/scraper";
  import { updateExistingManhwa } from "@/lib/updateManhwaLib.svelte";
  import { onMount } from "svelte";

  let show = $state(false);
  let added = $state(true);
  let loading = $state(false);
  let scraped = $state(scrapeCurrentPage());
  let existingManhwaId = $state<string | null>(null);
  let dismissed = $state(false);
  let mounted = $state(false);
  let libOpen = $state(true);

  $effect(() => {
    const loadExisting = async () => {
      if (!scraped.title) {
        existingManhwaId = null;
        return;
      }

      const [byTitle, byUrl] = await Promise.all([
        manhwaStore.getManhwaByTitleOnHost(scraped.title, scraped.sourceUrl),
        manhwaStore.getManhwaBySourceUrl(scraped.sourceUrl)
      ]);

      if (byTitle) {
        await updateExistingManhwa(scraped, scraped.sourceUrl);
      } else if (byUrl) {
        await updateExistingManhwa(scraped, scraped.sourceUrl);
      }

      existingManhwaId = byUrl?.id ?? byTitle?.id ?? null;
      added = existingManhwaId !== null;
    };

    void loadExisting();
  });

  onMount(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mounted = true;
      });
    });
  });

  async function addManhwa() {
    if (added || loading) return;
    loading = true;

    scraped = scrapeCurrentPage();
    if (!scraped) return;
    try {
      await manhwaStore.add(scraped);
      added = true;
    } catch (e) {
      console.error("[manhwa tracker] add failed", e);
    } finally {
      loading = false;
    }
  }
</script>

<AlertBox
  bind:open={show}
  title="Add to Library?"
  confirmLabel="Add"
  confirmColorFrom="#4338ca"
  confirmColorTo="#3730a3"
  onConfirm={addManhwa}
>
  <span class="title-add">{scraped?.title}</span>
</AlertBox>
<div class="pill-group" class:dismissed={dismissed || !libOpen} class:ready={mounted}>
  {#if !added}
    <div class="popup-container">
      <button
        class="toggle-button"
        onclick={(event) => {
          event.stopPropagation();
          show = !show;
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="add-icon"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Add to Library</span>
      </button>
    </div>
  {/if}
  {#if existingManhwaId}
    <ViewLib manhwaId={existingManhwaId} bind:dismissed bind:libOpen />
  {/if}
  <button
    class="dismiss-btn"
    aria-label="Dismiss Button"
    onclick={(event) => {
      event.stopPropagation();
      dismissed = true;
    }}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</div>

<style>
  .pill-group {
    position: fixed;
    left: 0;
    bottom: 0;
    margin: 20px;
    z-index: 100;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    font-size: 16px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    user-select: none;
    line-height: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 50px;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
    transition:
      transform 500ms ease-out,
      opacity 500ms ease-out;
  }

  .pill-group.ready {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
    /* transition: transform 500ms ease-in, opacity 500ms ease-in; */
  }

  .pill-group.dismissed {
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
    /* transition: transform 500ms ease-in, opacity 500ms ease-in; */
  }
  .popup-container {
    /* position: fixed;
    left: 0;
    bottom: 0; */
    /* margin: 20px; */
    z-index: 100;
    display: flex;
    align-items: flex-end;
    font-size: 16px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    user-select: none;
    line-height: 1;
    box-sizing: border-box;
  }

  .popup-container * {
    box-sizing: border-box; /* force it for all descendants, regardless of host page resets */
  }

  .toggle-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 150px;
    height: 40px;
    border-radius: 9999px;
    overflow: hidden;
    box-shadow:
      0 1px 3px 0 rgb(0 0 0 / 0.1),
      0 1px 2px -1px rgb(0 0 0 / 0.1);
    cursor: pointer;
    border: none;
    background: linear-gradient(0, #a157dd72, #4338ca);
    padding: 0;
    flex-shrink: 0; /* prevent flex from squishing the button if content is wide */
    transition:
      background-color 550ms ease,
      box-shadow 150ms ease,
      scale 120ms ease-in-out;
  }

  .toggle-button:active {
    transform: scale(0.9);
    transition: transform 150ms ease-in-out;
  }

  .toggle-button:hover {
    background-color: #9289cf;
  }

  .add-icon {
    width: 24px;
    height: 24px;
    padding: 4px;
    object-fit: contain;
    display: block; /* kills the small baseline gap inline images get by default */
  }

  .title-add {
    display: flex;
    align-items: center;
    justify-content: center;
    /* text-align: center; */
    font-size: 14px;
    font-weight: 600;
    margin-left: 8px;
    color: white;
  }

  .dismiss-btn {
    border-radius: 9999px;
    color: #94a3b8;
    background: transparent;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: none;
    /* z-index: 110; */
    /* padding: 0 10px; */
    transition:
      background-color 200ms ease-in-out,
      transform 200ms ease-in-out;
  }

  .dismiss-btn:hover {
    transform: rotate(-90deg) scale(1.1);
    background-color: rgba(248, 113, 113, 0.15);
    color: #f87171;
    transition:
      background-color 200ms ease-in-out,
      transform 200ms ease-in-out;
  }

  .dismiss-btn:active {
    transform: rotate(-180deg) scale(0.9);
    transition: transform 200ms ease-in-out;
  }
  .dismiss-btn svg {
    width: 13px;
    height: 13px;
  }
</style>
