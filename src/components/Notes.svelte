<script lang="ts">
  import type { Manhwa } from "@/types";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import InfoBox from "@/components/PopupBoxes/InfoBox.svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface NotesProps {
    manhwa: Manhwa;
  }

  let { manhwa }: NotesProps = $props();

  let notes = $derived(manhwa.notes ?? "");
  let isEditing = $state(false);
  let editedNotes = $state("");

  let notesDrawerOpen = $state(false);

  function openCloseNotes(event: MouseEvent) {
    event.stopPropagation();
    notesDrawerOpen = !notesDrawerOpen;
  }

  function openEditor() {
    editedNotes = notes;
    isEditing = true;
  }

  function handleSave() {
    manhwaStore.update(manhwa.id, { notes: editedNotes });
    isEditing = false;
    editedNotes = "";
  }
</script>

<InfoBox
  bind:open={isEditing}
  title="Edit Notes"
  closeLabel="Cancel"
  secondaryLabel="Save"
  onClick={handleSave}
  tagPicked={!!editedNotes}
>
  <div>
    <textarea bind:value={editedNotes} placeholder={"Enter your notes here..."} class="notes-input"> </textarea>
  </div>
</InfoBox>
<div class="notes-container">
  <button class="notes-display" onclick={openCloseNotes} aria-label="View Notes">
    View Notes
    <svg
      class="chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      class:is-open={notesDrawerOpen}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
  {#if notesDrawerOpen}
    <div transition:slide={{ duration: 400, easing: cubicOut }} class="notes-drawer">
      <div class="notes-content">
        {#if notes}
          <p>{notes}</p>
        {:else}
          <p class="no-notes">Add some notes...</p>
        {/if}
      </div>
      <button class="edit-notes-btn" onclick={openEditor} aria-label="Edit Notes"> Edit Notes </button>
    </div>
  {/if}
</div>

<style>
  .notes-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .notes-input {
    max-width: 100%;
    width: 100%;
    height: 90px;
    max-height: 110px;
    min-height: 110px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid #334155;
    background-color: #1e293b;
    color: #e8ebf0;
    font-size: 14px;
    transition: border-color 200ms ease-in-out;
  }

  .notes-input:focus {
    outline: none;
    border-color: #818cf8;
  }

  .notes-input::placeholder {
    color: #64748b;
  }

  .chevron {
    width: 16px;
    height: 16px;
    transition: transform 250ms ease-in-out;
  }

  .chevron.is-open {
    transform: rotate(180deg);
  }

  .notes-display {
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

  .notes-display:hover {
    color: #e8ebf0;
  }

  .notes-drawer {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 4px;
  }

  .notes-content {
    width: 100%;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 10px;
    min-width: 40%;
    min-height: 40px;
    padding: 10px 12px;
    color: #e8ebf0;
  }

  .no-notes {
    color: #64748b;
  }

  .edit-notes-btn {
    width: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    color: #c6ccd6;
    cursor: pointer;
    background: linear-gradient(-90deg, #1e293b, #334155);
    border: 1px solid #334155;
    transition:
      transform 200ms ease,
      border-color 200ms ease,
      color 200ms ease;
  }

  .edit-notes-btn:hover {
    transform: scale(1) translateY(-4px);
    border-color: #818cf8;
    color: #e8ebf0;
  }

  .edit-notes-btn:active:hover {
    transform: scale(0.9) translateY(1px);
    border-color: #475569;
    color: #e8ebf0;
  }
</style>
