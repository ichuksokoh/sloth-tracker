import { withLock } from "./asyncMutex";
import type { Manhwa } from "@/types";

const MANHWA_KEY = "manhwaList";
const RECENTLY_DELETED_KEY = "recentlyDeletedManhwa";
const RECENTLY_DELETED_RETENTION_MS = 1000 * 60 * 60 * 24 * 7;

async function readManhwaList(): Promise<Manhwa[]> {
  const res = await chrome.storage.local.get({ [MANHWA_KEY]: [] });
  const stored = res[MANHWA_KEY];
  return Array.isArray(stored) ? stored : [];
}

async function writeManhwaList(list: Manhwa[]) {
  await chrome.storage.local.set({ [MANHWA_KEY]: list });
}

async function readRecentlyDeleted(): Promise<(Manhwa & { __deletedAt: number })[]> {
  const res = await chrome.storage.local.get({ [RECENTLY_DELETED_KEY]: [] });
  const stored = res[RECENTLY_DELETED_KEY];
  return Array.isArray(stored) ? stored : [];
}

async function writeRecentlyDeleted(list: (Manhwa & { __deletedAt: number })[]) {
  await chrome.storage.local.set({ [RECENTLY_DELETED_KEY]: list });
}

export function addManhwa(manhwa: Manhwa) {
  return withLock(async () => {
    const list = await readManhwaList();
    list.push(manhwa);
    await writeManhwaList(list);
  });
}

export function updateManhwa(id: string, patch: Partial<Manhwa>) {
  return withLock(async () => {
    const list = await readManhwaList();
    const next = list.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m));
    await writeManhwaList(next);
  });
}

export function removeManhwa(id: string) {
  return withLock(async () => {
    const list = await readManhwaList();
    const removed = list.find((m) => m.id === id);
    const next = list.filter((m) => m.id !== id);
    await writeManhwaList(next);

    if (removed) {
      const deletedList = await readRecentlyDeleted();
      const now = Date.now();
      const pruned = deletedList.filter((m) => now - m.__deletedAt < RECENTLY_DELETED_RETENTION_MS);
      pruned.push({ ...removed, __deletedAt: now });
      await writeRecentlyDeleted(pruned);
    }
  });
}

export function clearManhwa() {
  return withLock(() => writeManhwaList([]));
}
