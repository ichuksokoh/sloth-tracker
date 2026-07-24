const KEY = "selectedManhwaId";

export async function setSelectedManhwa(id: string) {
  await chrome.storage.session.set({ [KEY]: id });
}

export async function setSelectedManhwaBg(id: string) {
  await chrome.runtime.sendMessage({ type: "set-selected-manhwa", id });
}

export async function getSelectedManhwa(): Promise<string | null> {
  const res = await chrome.storage.session.get(KEY);
  const value = res[KEY];
  return typeof value === "string" ? value : null;
}

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
export function onSelectedManhwaChange(callback: (id: string | null) => void) {
  const listener: Listener = (changes, area) => {
    if (area === "session" && KEY in changes) {
      const value = changes[KEY].newValue;
      callback(typeof value === "string" ? value : null);
    }
  };
  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
