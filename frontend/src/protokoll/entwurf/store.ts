/* Where a draft protocol is kept until there is a server to keep it on.
 *
 * Login (item 2) and server-side drafts (item 3) come after the form screens, by
 * the build-order decision of 2026-09-01, so for now a draft lives in the
 * browser it was typed into. Feature 3 replaces the body of these four functions
 * with API calls and leaves the interface alone.
 *
 * Nothing here touches React or the global localStorage directly. Storage, the
 * clock and the id generator are all arguments, which is what makes the failure
 * modes below testable without a browser.
 */

import { FORM_VERSION, type Entwurf } from './typen'

/** One key per draft. Namespaced because localStorage is shared with the locale. */
export const KEY_PREFIX = 'ffs-entwurf:'

export type SaveResult =
  | { status: 'saved'; entwurf: Entwurf }
  /* The draft is handed back even when it could not be stored. Losing what the
     user just typed because the disk is full would be worse than the failure
     itself; the save indicator reports it instead. */
  | { status: 'failed'; entwurf: Entwurf }

export interface EntwurfStore {
  createEntwurf(): Entwurf
  readEntwurf(id: string): Entwurf | null
  writeEntwurf(entwurf: Entwurf): SaveResult
  listEntwuerfe(): Entwurf[]
}

interface StoreOptions {
  storage: Storage
  now: () => string
  createId: () => string
}

/* A stored value is only trustworthy as far as it has been checked. Anything can
 * end up under our key: a half-written value from a killed tab, or a draft from
 * an older shape of this code. Nothing here parses deeply into antworten,
 * because a draft is incomplete by definition and every answer is optional. */
function isEntwurf(value: unknown): value is Entwurf {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.formVersion === 'string' &&
    typeof candidate.angelegtAm === 'string' &&
    typeof candidate.geaendertAm === 'string' &&
    typeof candidate.antworten === 'object' &&
    candidate.antworten !== null
  )
}

export function createEntwurfStore({
  storage,
  now,
  createId,
}: StoreOptions): EntwurfStore {
  /* Every read is wrapped, not only the JSON parse. Private browsing, blocked
     site data and a locked-down profile all make the accessor itself throw, and
     an unreadable draft means the same thing as a missing one. */
  function read(key: string): Entwurf | null {
    try {
      const stored = storage.getItem(key)
      if (stored === null) return null
      const parsed: unknown = JSON.parse(stored)
      return isEntwurf(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  function write(entwurf: Entwurf): boolean {
    try {
      storage.setItem(KEY_PREFIX + entwurf.id, JSON.stringify(entwurf))
      return true
    } catch {
      return false
    }
  }

  return {
    createEntwurf() {
      const timestamp = now()
      const entwurf: Entwurf = {
        id: createId(),
        formVersion: FORM_VERSION,
        angelegtAm: timestamp,
        geaendertAm: timestamp,
        antworten: {},
      }
      write(entwurf)
      return entwurf
    },

    readEntwurf(id) {
      return read(KEY_PREFIX + id)
    },

    writeEntwurf(entwurf) {
      // Stamped here rather than by the caller, so no component can save a draft
      // and leave it claiming it was last changed an hour ago.
      const updated: Entwurf = { ...entwurf, geaendertAm: now() }
      return write(updated)
        ? { status: 'saved', entwurf: updated }
        : { status: 'failed', entwurf: updated }
    },

    /* Scans the storage keys rather than maintaining an index alongside them.
       An index is a second write that can fail on its own, and a draft missing
       from it would be invisible even though its data is right there. There are
       tens of drafts on one machine, not thousands, so the scan is free. */
    listEntwuerfe() {
      const found: Entwurf[] = []
      try {
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (key === null || !key.startsWith(KEY_PREFIX)) continue
          const entwurf = read(key)
          if (entwurf !== null) found.push(entwurf)
        }
      } catch {
        return []
      }
      // ISO timestamps sort correctly as plain strings, newest first.
      return found.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm))
    },
  }
}

/* Storage that forgets everything when the tab closes.
 *
 * Used only when the real localStorage cannot be reached at all, which a
 * locked-down profile or a blocked-site-data setting can cause on the property
 * access itself. Drafts then last for the session instead of the app breaking on
 * load, and the save indicator is honest about the rest. */
function memoryStorage(): Storage {
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

function browserStorage(): Storage {
  try {
    return window.localStorage
  } catch {
    return memoryStorage()
  }
}

export const entwurfStore = createEntwurfStore({
  storage: browserStorage(),
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
})
