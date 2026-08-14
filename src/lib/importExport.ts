import type { Manhwa, LibraryExport, ImportResult, ImportOptions, ManhwaExport, ImportProgress } from "@/types";
import { manhwaStore } from "./manhwaStore.svelte";
import * as manhwaDB from "./manhwaDataAccess";
import { ImportResultSchema, LibraryExportSchema, ManhwaExportSchema, ManhwaSchema } from "@/types";
import { blobToBase64, getCachedCover } from "./coverCache.svelte";

export const EXPORT_VERSION = 1;

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick — some browsers need the click to fully process first
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportLibraryAsJson(manhwas: Manhwa[], includeImages: boolean = true) {
  const exportManhwas: ManhwaExport[] = await Promise.all(
    manhwas.map(async (m) => {
      const blob = includeImages ? await getCachedCover(m.id) : null;
      const coverImage = blob ? await blobToBase64(blob) : undefined;
      return { ...m, coverImage };
    })
  );
  const payload: LibraryExport = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    manhwas: exportManhwas
  };

  const filename = `manhwa-library-${new Date().toISOString().slice(0, 10)}.json`;
  downloadFile(JSON.stringify(payload, null, 2), filename, "application/json");
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLibraryAsCsv(manhwas: Manhwa[]) {
  const columns = [
    "title",
    "status",
    "favorite",
    "hidden",
    "currentChapter",
    "totalChapters",
    "rating",
    "sourceUrl",
    "tags",
    "ogTags",
    "notes",
    "startedOn",
    "completedOn"
  ] as const;

  const rows = manhwas.map((m) =>
    columns
      .map((col) => {
        if (col === "tags" || col === "ogTags") return csvEscape(m.tags.map((t) => t.tagName).join("; "));
        if (col === "completedOn") {
          return csvEscape(m.completedOn ? new Date(m.completedOn).toISOString() : "");
        }
        if (col === "startedOn") {
          return csvEscape(m.startedOn ? new Date(m.startedOn).toISOString() : "");
        }
        return csvEscape(m[col as keyof Manhwa]);
      })
      .join(",")
  );

  const csv = [columns.join(","), ...rows].join("\n");
  const filename = `manhwa-library-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csv, filename, "text/csv");
}

function isValidManhwa(x: unknown): x is ManhwaExport {
  return ManhwaExportSchema.safeParse(x).success;
}

export async function parseImportFile(file: File): Promise<LibraryExport> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const obj = LibraryExportSchema.safeParse(parsed);
  if (!obj.success) {
    throw new Error("File doesn't match the expected library export format.");
  }
  if (typeof obj.data.version !== "number") {
    throw new Error("Missing export version — this file may be from an incompatible source.");
  }

  return obj.data;
}

export async function importLibrary(
  data: LibraryExport,
  opts: ImportOptions = { onConflict: "skip" },
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const total = data.manhwas.length;

  for (let i = 0; i < total; i++) {
    const raw = data.manhwas[i];
    const title = ManhwaSchema.safeParse(raw).success ? raw.title : "Unknown Title";

    const progress: ImportProgress = { current: i + 1, total, title };
    await chrome.storage.session.set({ importProgress: progress });
    // best-effort live update if a popup happens to be open; silently no-ops otherwise
    chrome.runtime.sendMessage({ type: "import:progress", progress }).catch(() => {});

    if (!isValidManhwa(raw)) {
      const errMsg = ManhwaSchema.safeParse(raw).error?.message;
      result.errors.push(`Skipped invalid entry: ${JSON.stringify(raw).slice(0, 80)}\n\n Error: ${errMsg}`);
      continue;
    }

    const existing = manhwaStore.list.find((m) => m.id === raw.id);
    if (existing && opts.onConflict === "skip") {
      result.skipped++;
      continue;
    }

    await manhwaDB.upsertManhwa(raw, opts); // adjust to whatever your store's write method is named
    console.log("[importExport] imported manhwa:", raw.title);
    result.imported++;
  }

  await chrome.storage.session.set({ importProgress: null, importResult: result });
  chrome.runtime.sendMessage({ type: "import:done", result }).catch(() => {});
  return result;
}
