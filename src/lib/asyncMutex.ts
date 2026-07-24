// Serializes async operations: each call to withLock waits for the
// previous one to fully finish (success or failure) before running.
let queue: Promise<unknown> = Promise.resolve();

export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(
    () => undefined,
    () => undefined // never let a rejection break the chain for subsequent callers
  );
  return result;
}
