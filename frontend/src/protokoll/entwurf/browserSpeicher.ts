/* Somewhere to put things that survives a reload, and something to fall back on
 * when there is not.
 *
 * Reaching for window.localStorage is not safe on its own. A private window, a
 * locked-down profile and a blocked-site-data setting all make the property
 * access itself throw, before any key is read, so an app that touches it at
 * module level simply fails to start in those browsers.
 *
 * Lived in protokoll/entwurf/store.ts until feature 3b moved drafts to the
 * server. The safety copy still needs it, and it was copied rather than moved on
 * the first pass, so it is one thing here instead of two that can drift.
 */

/* Storage that forgets everything when the tab closes.
 *
 * Whatever is kept in it then lasts for the session rather than the app breaking
 * on load. Callers stay honest about the difference through their own reporting:
 * nothing here pretends the write was durable.
 */
export function memoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  }
}

/** The real thing where it can be reached, and the stand-in where it cannot. */
export function browserStorage(): Storage {
  try {
    return window.localStorage
  } catch {
    return memoryStorage()
  }
}
