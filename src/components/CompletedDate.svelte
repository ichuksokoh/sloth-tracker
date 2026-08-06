<script lang="ts">
  import InfoBox from "@/components/PopupBoxes/InfoBox.svelte";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import type { Manhwa } from "@/types";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  interface FinishedDateProps {
    manhwa: Manhwa;
  }

  let { manhwa }: FinishedDateProps = $props();

  // Helper function to format a Date object as a local ISO date string (YYYY-MM-DD)
  // because UTC offset issues can cause the Date constructor
  // to interpret the date incorrectly copmared to local time.
  function localISODate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseLocalISODate(dateString: string): Date {
    const [yyyy, mm, dd] = dateString.split("-").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  let dateEditorOpen = $state(false);

  const finishedDate = $derived(manhwa.completedOn ? new Date(manhwa.completedOn) : null);

  let inputDate = $state("");
  let errorMsg = $state("");
  const touchedDate = $derived(finishedDate ? localISODate(finishedDate) !== inputDate : inputDate !== "");


  async function openDateEditor() {
    if (finishedDate) {
      inputDate = localISODate(finishedDate);
    } else {
      inputDate = "";
    }
    errorMsg = "";
    dateEditorOpen = true;
  }
  function handleSave() {
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    if (inputDate && parseLocalISODate(inputDate) > oneYearFromToday) {
      errorMsg = "Finished date cannot be more than one year in the future.";
      return;
    } else if (inputDate && parseLocalISODate(inputDate) < new Date(manhwa.createdAt)) {
      errorMsg = "Finished date cannot be before the manhwa was added.";
      return;
    } else if (inputDate && manhwa.status === "Completed") {
      // Convert the input date string to a timestamp and update the manhwa's completedOn property
      // We do this because of UTC offset issues with the Date Consstructor compared to local time
      manhwaStore.update(manhwa.id, { completedOn: parseLocalISODate(inputDate)?.getTime() });
    } else if (inputDate === "" && manhwa.status === "Completed") {
      // If the input date is empty and the manhwa is completed, clear the completedOn property
      manhwaStore.update(manhwa.id, { completedOn: null });
    } else if (inputDate && manhwa.status !== "Completed") {
      errorMsg = "You can only set a finished date for completed manhwas.";
      return;
    }
    dateEditorOpen = false;
  }

  function handleInputSave(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSave();
    }
  }
</script>

<InfoBox
  bind:open={dateEditorOpen}
  title="Edit Completed Date"
  secondaryLabel="Save"
  onClick={handleSave}
  showSecondary={touchedDate}
>
  <div class="date-editor">
    <input
      type="date"
      bind:value={inputDate}
      class="date-input"
      placeholder="Select a date"
      onkeydown={handleInputSave}
    />

    {#if errorMsg}
      <p transition:fade={{ duration: 250, delay: 0, easing: cubicOut }} class="error-message">{errorMsg}</p>
    {/if}
  </div>
</InfoBox>
<div>
  <button class="finished-date-btn" onclick={openDateEditor} aria-label="Edit Completed Date">
    {#if finishedDate}
      Completed: {finishedDate.toLocaleDateString()}
    {:else}
      Set Completed Date
    {/if}
  </button>
</div>

<style>
  .date-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .date-input {
    padding: 4px 8px;
    border-radius: 12px;
    background-color: #1e293b;
    width: 70%;
    border: 1px solid #ccc;
    font-size: 14px;
  }

  .finished-date-btn {
    height: 32px;
    width: 150px;
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
    background: linear-gradient(180deg, #323e51 0%, #1f3059 100%);
    border: none;
    transition: transform 250ms ease, color 250ms ease-in-out;
  }

  .finished-date-btn:hover {
    color: #cbd5e1;
  }

  .finished-date-btn:active {
    transform: scale(0.92);
  }

  .error-message {
    color: #f87171; /* Tailwind's red-400 */
    font-size: 12px;
    font-weight: 500;
    margin: 0;
  }
</style>
