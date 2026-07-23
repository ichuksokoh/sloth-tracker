<script lang="ts">
  import * as selectManwha from '@/lib/selectedManhwa.svelte'

  let { manhwaId, dismissed = $bindable(false) }: { manhwaId: string; dismissed: boolean } = $props()

  let sidePanelOpenAlready = $state(false)
  let notSameManhwa = $state(true)
  let ready = $state(false)
  let showing = $derived(ready && (!sidePanelOpenAlready || notSameManhwa) || dismissed)

  async function checkSidePanelAndSelection() {
    try {
      const panelRes = await chrome.runtime.sendMessage({ type: 'is-sidepanel-open' })
      if (!panelRes?.ok) {
        sidePanelOpenAlready = false
        notSameManhwa = true
        return
      }

      sidePanelOpenAlready = true
      const selectedRes = await chrome.runtime.sendMessage({ type: 'get-selected-manhwa' })
      notSameManhwa = selectedRes?.id !== manhwaId
    } finally {
      ready = true
    }
  }

  $effect(() => {
    checkSidePanelAndSelection()
  })

  async function handleViewLib() {
    await selectManwha.setSelectedManhwaBg(manhwaId)
    const response = await chrome.runtime.sendMessage({ type: 'open-sidepanel' })
    if (response?.ok) {
      sidePanelOpenAlready = true
      notSameManhwa = false
      dismissed = true
    } else {
      console.error('[viewlib] failed to open side panel')
    }
  }
</script>

<!-- {#if showing} -->
  <div class="popup-container" class:not-showing={!showing}>
    <button class="toggle-button" onclick={handleViewLib}>
      <span>View In Library</span>
    </button>
  </div>
<!-- {/if} -->
<style>
  .popup-container {
    /* position: fixed;
    left: 0;
    bottom: 0; */
    z-index: 100;
    display: flex;
    align-items: flex-end;
    font-size: 16px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    user-select: none;
    line-height: 1;
    box-sizing: border-box;
  }

  .popup-container.not-showing {
    opacity: 0;
    pointer-events: none;
    transform: translateX(0);
    transition: transform 300ms ease-in, opacity 300ms ease-in;
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
    transition: background-color 550ms ease, box-shadow 150ms ease, scale 200ms ease-in-out;
  }

  .toggle-button:active {
    transform: scale(0.95);
    transition: transform 200ms ease-in-out;
  }
  
  .toggle-button:hover {
    background-color: #9289cf;
  }

</style>