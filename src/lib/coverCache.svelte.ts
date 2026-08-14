import type { Manhwa } from "@/types";

const DB_NAME = "manhwa-covers";
const STORE_NAME = "covers";
let dbPromise: Promise<IDBDatabase> | null = null;
const urlCache = new Map<string, string | null>(); // id -> resolved url, or null if no cover
const pending = new Map<string, Promise<string | null>>();



function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function cacheCover(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCover(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCachedCover(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const cached = urlCache.get(id);
  if (cached?.startsWith("blob:")) URL.revokeObjectURL(cached);
  urlCache.delete(id);
  pending.delete(id);
}

export async function preloadCover(manhwa: Manhwa): Promise<string | null> {
  if (urlCache.has(manhwa.id)) return urlCache.get(manhwa.id)!;
  if (pending.has(manhwa.id)) return pending.get(manhwa.id)!;

  const promise = (async () => {
    const blob = await getCachedCover(manhwa.id);
    const resolved = blob ? URL.createObjectURL(blob) : manhwa.coverUrl ?? null;
    urlCache.set(manhwa.id, resolved);
    pending.delete(manhwa.id);
    return resolved;
  })();

  pending.set(manhwa.id, promise);
  return promise;
}

export function retrieveCover(getManhwa: () => Manhwa | undefined | null) {
  let url = $state<string | null>(null);

  $effect(() => {
    const manhwa = getManhwa();
    if (!manhwa) {
      url = null;
      return;
    }

    if (urlCache.has(manhwa.id)) {
      url = urlCache.get(manhwa.id)!;
      return;
    }

    let cancelled = false;
    preloadCover(manhwa).then((resolved) => {
      if (!cancelled) url = resolved;
    });

    return () => {
      cancelled = true;
    };
  });

  return {
    get url() {
      return url;
    }
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000; // avoid call-stack blowup on large images
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
