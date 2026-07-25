type StorageArea = 'local' | 'session'

function createStorageField<T>(
  key: string,
  defaultValue: T,
  area: StorageArea,
  isValid: (v: unknown) => v is T
) {
  const storage = area === 'local' ? chrome.storage.local : chrome.storage.session

  return {
    async set(value: T) {
      await storage.set({ [key]: value })
    },
    async get(): Promise<T> {
      const res = await storage.get(key)
      const value = res[key]
      return isValid(value) ? value : defaultValue
    },
    onChange(callback: (value: T) => void) {
      chrome.storage.onChanged.addListener((changes, changedArea) => {
        if (changedArea !== area || !(key in changes)) return
        const value = changes[key].newValue
        callback(isValid(value) ? value : defaultValue)
      })
    },
  }
}

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string'

export const searchQuery = createStorageField('searchQuery', '', 'session', isString)
export const showFavoritesOnly = createStorageField('showFavoritesOnly', false, 'session', isBoolean)
export const statusFilter = createStorageField('statusFilter', 'All', 'session', isString)
export const hiddenFilter = createStorageField('hiddenFilter', false, 'session', isBoolean)
export const toggleManhwaCount = createStorageField('toggleManhwaCount', false, 'local', isBoolean)
export const sortByOption = createStorageField('sortByOption', 'Ascending', 'local', isString)