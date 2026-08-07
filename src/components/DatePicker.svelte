<script lang="ts">
  import InfoBox from "@/components/PopupBoxes/InfoBox.svelte";
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import type { Manhwa, ReadStatus } from "@/types";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  interface DatePickerProps {
    manhwa: Manhwa;
    forStatus: ReadStatus; // status to determine which date to update
  }

  let { manhwa, forStatus }: DatePickerProps = $props();

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
  const dateMap = $derived<Partial<Record<ReadStatus, Date | null>>>({
    Completed: manhwa.completedOn ? new Date(manhwa.completedOn) : null,
    Reading: manhwa.startedOn ? new Date(manhwa.startedOn) : null
  });

  const errMap = $derived<Partial<Record<ReadStatus, string>>>({
    Completed: "You can only set an end date for completed manga/manhwa.",
    Reading: "You can only set a start date for manga/manhwa marked read."
  });

  const labelMap = $derived<Partial<Record<ReadStatus, string>>>({
    Completed: "End Date",
    Reading: "Start Date"
  });

  const statusDate = $derived(dateMap[forStatus] ? new Date(dateMap[forStatus]) : null);

  let inputDate = $state("");
  let errorMsg = $state("");
  const touchedDate = $derived(statusDate ? localISODate(statusDate) !== inputDate : inputDate !== "");

  async function openDateEditor() {
    if (statusDate) {
      inputDate = localISODate(statusDate);
    } else {
      inputDate = "";
    }
    errorMsg = "";
    dateEditorOpen = true;
  }

  function handleSave() {
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    const validInput = inputDate === "" || inputDate;
    if (inputDate && parseLocalISODate(inputDate) > oneYearFromToday) {
      errorMsg = "Date cannot be more than one year in the future.";
      return;
    } else if (inputDate && parseLocalISODate(inputDate) < new Date(manhwa.createdAt)) {
      errorMsg = "Date cannot be before the manhwa was added.";
      return;
    } else if (validInput && manhwa.status !== forStatus) {
      errorMsg = errMap[forStatus] || "Unexpected error: please try again.";
      return;
    } else if (validInput && forStatus === "Completed") {
      // Convert the input date string to a timestamp and update the matching date property
      // We do this because of UTC offset issues with the Date Consstructor compared to local time
      const completedDate = parseLocalISODate(inputDate)?.getTime() || null;
      manhwaStore.update(manhwa.id, { completedOn: completedDate });
    } else if (validInput && forStatus === "Reading") {
      const startedDate = parseLocalISODate(inputDate)?.getTime() || null;
      manhwaStore.update(manhwa.id, { startedOn: startedDate });
      dateEditorOpen = false;
    }
  }

  function handleInputSave(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSave();
    }
  }
</script>

<InfoBox
  bind:open={dateEditorOpen}
  title="Edit {labelMap[forStatus] || 'Date'}"
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
  <button class="date-picker-btn" onclick={openDateEditor} aria-label="Edit {labelMap[forStatus] || 'Date'}">
    {#if statusDate}
      {labelMap[forStatus] || "Date"}: {statusDate.toLocaleDateString()}
    {:else}
      Set {labelMap[forStatus] || "Date"}
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

  .date-picker-btn {
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
    background: #1e293b;
    /* background: linear-gradient(180deg, #323e51 0%, #1f3059 100%); */
    border: 1px solid #334155;
    /* border: none; */
    transition:
      transform 250ms ease,
      color 250ms ease-in-out;
  }

  .date-picker-btn:hover {
    color: #cbd5e1;
  }

  .date-picker-btn:active {
    transform: scale(0.92);
  }

  .error-message {
    color: #f87171; /* Tailwind's red-400 */
    font-size: 12px;
    font-weight: 500;
    margin: 0;
  }
</style>
