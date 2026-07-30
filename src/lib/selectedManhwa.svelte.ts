const KEY = "selectedManhwaId";
const KEY_LOCAL = "selectedManhwaIdLocal";

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


export async function setSelectedManhwaLocal(id: string) {
  chrome.storage.local.set({ [KEY_LOCAL]: id });
}

export function getSelectedManhwaLocal(): string | null {
  const value = chrome.storage.local.get(KEY_LOCAL);
  return typeof value === "string" ? value : null;
}

export  function onSelectedManhwaLocalChange(callback: (id: string | null) => void) {
  const listener: Listener = (changes, area) => {
    if (area === "local" && KEY_LOCAL in changes) {
      const value = changes[KEY_LOCAL].newValue;
      callback(typeof value === "string" ? value : null);
    }
  };
  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export async function setSelectedManhwaAll(id: string) {
  await setSelectedManhwa(id);
  await setSelectedManhwaLocal(id);
}