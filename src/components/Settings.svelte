<script lang="ts">
  import { manhwaStore } from "@/lib/manhwaStore.svelte";
  import { exportLibraryAsJson, exportLibraryAsCsv, parseImportFile, importLibrary } from "@/lib/importExport";
  import { toastStore } from "@/lib/toastStore.svelte";
  import InfoBox from "./PopupBoxes/InfoBox.svelte";
  import CheckBox from "./CheckBox.svelte";
  import type { ImportProgress, SettingsConfig } from "@/types";
  import { Spring } from "svelte/motion";
  import * as fields from "@/lib/storageField";

  interface SettingsProps {
    size?: number;
  }

  let { size = 28 }: SettingsProps = $props();

  let open = $state(false);
  let fileInput = $state<HTMLInputElement>();
  let importStatus = $state("");
  let importProgress = $state<ImportProgress | null>(null);
  let settingsConfigs = $state<SettingsConfig | null>(null);
  let importOption = $state<boolean>(false); // false = skip, true = overwrite
  let markUnreadOne = $state(false); // false = mark all Unread, true = mark only one unread
  let includeImages = $state(false); // false = don't include images, true = include images

  const progress = new Spring(0, {
    stiffness: 0.08,
    damping: 0.6
  });

  $effect(() => {
    progress.target = importProgress ? (importProgress.current / importProgress.total) * 100 : 0;
  });

  $effect(() => {
    fields.settingsConfigs.get().then((value) => {
      if (value) {
        settingsConfigs = value as SettingsConfig;
        importOption = value.importOption === "overwrite";
        markUnreadOne = value.markUnreadOne;
        includeImages = value.includeImages;
      }
    });
  });

  $effect(() => {
    fields.settingsConfigs.set({
      ...settingsConfigs,
      importOption: importOption ? "overwrite" : "skip",
      markUnreadOne,
      includeImages
    });
  });

  async function handleImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const data = await parseImportFile(file);
      const onConflictOption = importOption ? "overwrite" : "skip";
      await chrome.runtime.sendMessage({ type: "library:import", data, opts: { onConflict: onConflictOption } });
      // progress now comes in via the listener below, not from awaiting this call
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      importStatus = msg;
      toastStore.show(msg);
    } finally {
      (e.target as HTMLInputElement).value = "";
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "import:progress") importProgress = msg.progress;
    if (msg.type === "import:done") {
      importProgress = null;
      importStatus = `Imported ${msg.result.imported}, skipped ${msg.result.skipped}`;
      toastStore.show(`Import complete — ${msg.result.imported} added`);
    }
  });

  // rehydrate on mount, in case the popup reopens mid-import
  $effect(() => {
    chrome.runtime.sendMessage({ type: "library:import-status" }).then((res) => {
      if (res?.progress) importProgress = res.progress;
    });
  });
  async function handleExportJson() {
    await exportLibraryAsJson(manhwaStore.list, includeImages);
    toastStore.show("Library exported as JSON");
  }

  function handleExportCsv() {
    exportLibraryAsCsv(manhwaStore.list);
    toastStore.show("Library exported as CSV");
  }
</script>

<button
  style={`width: ${size}px; height: ${size}px;`}
  class="settings-btn"
  aria-label="Settings"
  aria-pressed={open}
  onclick={() => (open = !open)}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
    />
    <circle cx="12" cy="12" r="3" />
  </svg>
</button>

<InfoBox bind:open title="Settings" secondaryLabel="Save">
  <div class="settings-content">
    <section class="io-block">
      <span class="io-label">Import</span>
      <p class="io-hint">Restore a library from a previously exported JSON file.</p>

      {#if importProgress}
        <div class="import-progress">
          <p class="import-progress-title">{importProgress.title}</p>
          <div class="progress-track">
            <div class="progress-fill" style={`width: ${progress.current}%`}></div>
          </div>
          <span class="progress-count">{importProgress.current} / {importProgress.total}</span>
        </div>
      {:else}
        <div class="io-row">
          <input type="file" accept="application/json" bind:this={fileInput} onchange={handleImport} hidden />
          <button onclick={() => fileInput?.click()} class="action-btn">Import</button>
          <CheckBox bind:checked={importOption} label="Overwrite existing entries" />
        </div>
        {#if importStatus}
          <p class="import-status">{importStatus}</p>
        {/if}
      {/if}
    </section>

    <section class="io-block">
      <span class="io-label">Export</span>
      <p class="io-hint">
        JSON is a full backup — use it to restore your library later. CSV is for viewing in a spreadsheet only and
        can't be imported back.
      </p>
      <div class="io-row">
        <button onclick={handleExportJson} class="action-btn">Export JSON</button>
        <CheckBox bind:checked={includeImages} label="Include images" />
      </div>
      <div class="io-row">
        <button onclick={handleExportCsv} class="action-btn">Export CSV</button>
      </div>
    </section>

    <section>
      <span class="io-label">Config Options</span>
      <p class="io-hint">Other settings for sloth tracker.</p>
      <div class="io-row">
        <CheckBox bind:checked={markUnreadOne} label="Unread one chapter at a time" />
      </div>
    </section>
  </div>
</InfoBox>

<style>
  .settings-btn {
    appearance: none;
    background: none;
    border: none;
    position: absolute;
    right: -4px;
    top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    border-radius: 12px;
    cursor: pointer;
    color: #64748b;
    transition:
      rotate 500ms cubic-bezier(0.39, 0.575, 0.565, 1),
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .settings-btn:hover {
    rotate: 360deg;
  }

  .settings-btn svg {
    width: 20px;
    height: 20px;
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 320px;
    min-width: 320px;
  }

  .io-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .io-label {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .io-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #64748b;
  }

  .io-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .import-status {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .action-btn {
    padding: 5px 12px;
    border-radius: 10px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      transform 200ms cubic-bezier(0.61, 1, 0.88, 1),
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .action-btn:hover {
    border-color: #475569;
    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
    transform: translateY(-2px);
  }

  .action-btn:active {
    transform: scale(0.92);
  }

  .import-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .import-progress-title {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-track {
    height: 6px;
    border-radius: 999px;
    background: #1e293b;
    border: 1px solid #334155;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #818cf8;
    border-radius: 999px;
    /* transition: width 150ms ease; */
  }

  .progress-count {
    font-size: 11px;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }
</style>
