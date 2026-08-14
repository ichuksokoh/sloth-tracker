// toastStore.svelte.ts
import type { ToastItem } from "@/types";

const MAX_TOASTS = 2;
const EXIT_MS = 250; // must match the fly transition duration in ToastContainer

let toasts = $state<ToastItem[]>([]);
let nextId = 0;



const queue: Omit<ToastItem, "id">[] = [];
let draining = false;

function show(message: string, duration = 2500) {
  queue.push({ message, duration });
  drain();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function drain() {
  if (draining) return; // already processing — new entries just sit in `queue`
  draining = true;

  while (queue.length > 0) {
    if (toasts.length >= MAX_TOASTS) {
      // wait for the oldest to fully exit before adding the next one
      dismiss(toasts[0].id);
      await sleep(EXIT_MS);
    }
    const next = queue.shift()!;
    toasts.push({ id: nextId++, message: next.message, duration: next.duration });
  }

  draining = false;
}


function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
}

export const toastStore = {
  get toasts() {
    return toasts;
  },
  show,
  dismiss
};