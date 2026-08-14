import { SettingsConfigSchema, type SettingsConfig } from "@/types";

type StorageArea = "local" | "session";

const NONE = Symbol("none");
function createStorageField<T>(key: string, defaultValue: T, area: StorageArea, isValid: (v: unknown) => v is T) {
  const storage = area === "local" ? chrome.storage.local : chrome.storage.session;

  // The value we most recently wrote locally and haven't yet seen echoed back.
  // While this is set, any onChange event that DISAGREES with it is a stale
  // echo from an earlier write we've since superseded — drop it. Once the
  // matching echo arrives (or the safety timeout fires), we go back to
  // trusting onChange normally, so cross-context sync isn't broken.
  let pendingValue: T | typeof NONE = NONE;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPending() {
    pendingValue = NONE;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  return {
    async set(value: T) {
      pendingValue = value;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(clearPending, 750); // safety net if an echo never arrives
      await storage.set({ [key]: value });
    },
    async get(): Promise<T> {
      const res = await storage.get(key);
      const value = res[key];
      return isValid(value) ? value : defaultValue;
    },
    onChange(callback: (value: T) => void) {
      chrome.storage.onChanged.addListener((changes, changedArea) => {
        if (changedArea !== area || !(key in changes)) return;
        const raw = changes[key].newValue;
        const value = isValid(raw) ? raw : defaultValue;
        if (pendingValue !== NONE) {
          if (value === pendingValue) {
            clearPending(); // our own write's echo — done waiting, resume normal trust
          } else {
            return; // stale echo of an earlier write we've since overwritten — drop it
          }
        }
        callback(value);
      });
    }
  };
}

const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
const isString = (v: unknown): v is string => typeof v === "string";
const isSettingConfig = (v: unknown): v is SettingsConfig => {
  return SettingsConfigSchema.safeParse(v).success;
};
export const searchQuery = createStorageField("searchQuery", "", "session", isString);
export const showFavoritesOnly = createStorageField("showFavoritesOnly", false, "session", isBoolean);
export const statusFilter = createStorageField("statusFilter", "All", "session", isString);
export const hiddenFilter = createStorageField("hiddenFilter", false, "session", isBoolean);
export const toggleManhwaCount = createStorageField("toggleManhwaCount", false, "local", isBoolean);
export const sortByField = createStorageField("sortByField", "Title", "local", isString);
export const sortByDirection = createStorageField("sortByDirection", "asc", "local", isString);
export const settingsConfigs = createStorageField(
  "settingConfigs",
  { importOption: "skip", markUnreadOne: false, includeImages: true },
  "local",
  isSettingConfig
);
