/* Where a protocol's attachments are kept until there is a server to keep them
 * on.
 *
 * The same arrangement as entwurf/store.ts and for the same reason: login
 * (item 2) and server-side drafts (item 3) come after the form screens, so for
 * now an attachment lives in the browser it was picked in. Feature 3 replaces
 * the body of createAnlagenStore with API calls and leaves its interface alone.
 *
 * IndexedDB rather than localStorage, which is the one real difference from the
 * draft store. localStorage holds around 5 MB in total and stores text, and a
 * single phone photograph can exceed that on its own.
 *
 * Nothing here touches React. The storage, the clock and the id generator are
 * all arguments, which is what makes the two failures that matter, a full disk
 * and a database the browser refuses to open, testable without a browser.
 *
 * Nothing deletes a draft yet, so nothing here cleans up after one. When
 * feature 3 gives drafts a life cycle, deleting one has to delete its
 * attachments too, or the files stay in the browser with nothing pointing at
 * them.
 */

import type { Anlage, Anlagenart } from './typen'

/** The database and its one object store. Namespaced like KEY_PREFIX is. */
const DB_NAME = 'ffs-anlagen'
const STORE_NAME = 'anlagen'
const DB_VERSION = 1
const ENTWURF_INDEX = 'entwurfId'

/* The narrow slice of a database this store needs.
 *
 * list hands back metadata only while readDatei fetches one file at a time, so
 * drawing a list of twenty photographs does not pull 200 MB into memory to
 * print twenty headings. It is also the shape feature 3 wants: metadata is what
 * travels as JSON, and the bytes go up separately as a body.
 */
export interface AnlagenStorage {
  put(anlage: Anlage, datei: Blob): Promise<void>
  remove(id: string): Promise<void>
  list(entwurfId: string): Promise<Anlage[]>
  readDatei(id: string): Promise<Blob | undefined>
}

/* Why a write failed, because the two need different things said to the person
 * reading them. 'full' is the device being out of room and is nobody's mistake;
 * 'unavailable' is a browser that will not store anything at all, which a
 * private window or a locked-down profile causes and which no amount of freeing
 * space will fix. */
export type FailureReason = 'full' | 'unavailable'

export type AnlageResult =
  | { status: 'saved'; anlage: Anlage }
  | { status: 'failed'; reason: FailureReason }

/* Deliberately not just an empty array on failure. The section has to tell
   "nothing attached yet" from "this browser will not store attachments", since
   only one of those is worth a message. */
export type ListResult =
  | { status: 'loaded'; anlagen: Anlage[] }
  | { status: 'unavailable' }

export interface AnlagenStore {
  listAnlagen(entwurfId: string): Promise<ListResult>
  addAnlage(entwurfId: string, art: Anlagenart, datei: File): Promise<AnlageResult>
  removeAnlage(id: string): Promise<boolean>
  readDatei(id: string): Promise<Blob | null>
}

interface StoreOptions {
  storage: AnlagenStorage
  now: () => string
  createId: () => string
}

/* A full disk is the one failure a surveyor can act on, so it is worth telling
 * apart from every other reason a write can fail.
 *
 * Browsers disagree about how they report it. Chrome and Safari throw a
 * DOMException named QuotaExceededError; Firefox has historically used
 * NS_ERROR_DOM_QUOTA_REACHED, and older builds sent code 22. Anything else is
 * treated as the database being unavailable, which is the more cautious of the
 * two messages: it does not tell somebody to free disk space that would not
 * help.
 */
function reasonFor(error: unknown): FailureReason {
  if (error instanceof DOMException) {
    const outOfRoom =
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22
    if (outOfRoom) return 'full'
  }
  return 'unavailable'
}

export function createAnlagenStore({
  storage,
  now,
  createId,
}: StoreOptions): AnlagenStore {
  return {
    async listAnlagen(entwurfId) {
      try {
        const anlagen = await storage.list(entwurfId)
        // Oldest first, so photographs stay in the order they were added rather
        // than shuffling every time the section is reopened.
        return {
          status: 'loaded',
          anlagen: [...anlagen].sort((a, b) =>
            a.angelegtAm.localeCompare(b.angelegtAm),
          ),
        }
      } catch {
        return { status: 'unavailable' }
      }
    },

    async addAnlage(entwurfId, art, datei) {
      /* Described from what the browser reported about the file and nothing
         else. The name is kept exactly as picked, including its extension and
         any spaces: it is what the surveyor will look for on their own machine
         when a message names it. */
      const anlage: Anlage = {
        id: createId(),
        entwurfId,
        art,
        dateiname: datei.name,
        mimeType: datei.type,
        groesse: datei.size,
        angelegtAm: now(),
      }

      try {
        await storage.put(anlage, datei)
        return { status: 'saved', anlage }
      } catch (error) {
        return { status: 'failed', reason: reasonFor(error) }
      }
    },

    async removeAnlage(id) {
      try {
        await storage.remove(id)
        return true
      } catch {
        return false
      }
    },

    async readDatei(id) {
      try {
        return (await storage.readDatei(id)) ?? null
      } catch {
        return null
      }
    },
  }
}

/* IndexedDB, wrapped so that the rest of the application never sees a request
 * object or an event handler.
 *
 * Every call opens the database rather than holding one connection open. A held
 * connection blocks another tab from upgrading the schema, and a surveyor with
 * the same protocol open twice is an ordinary thing rather than an edge case.
 * Opening is cheap once the database exists.
 */
function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    /* The property access itself throws in a locked-down profile, before any
       request exists to attach a handler to. */
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'anlage.id' })
        store.createIndex(ENTWURF_INDEX, 'anlage.entwurfId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    /* A second tab holding an old version open. Rejecting is honest: the caller
       turns it into "attachments cannot be saved right now" rather than hanging
       on a promise that may never settle. */
    request.onblocked = () => reject(new DOMException('blocked', 'InvalidStateError'))
  })
}

/* One row is the record and the bytes together, keyed on the record's id.
 * Storing the Blob in the same row is what lets a delete be one operation and
 * keeps a file from ever outliving the record that describes it. */
interface Row {
  anlage: Anlage
  datei: Blob
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await work(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  } finally {
    /* Safe immediately after the request resolves: close() only marks the
       connection as closing, and the browser finishes any transaction still
       running before it actually goes. */
    db.close()
  }
}

function indexedDbStorage(): AnlagenStorage {
  return {
    async put(anlage, datei) {
      await withStore('readwrite', (store) =>
        asPromise(store.put({ anlage, datei } satisfies Row)),
      )
    },

    async remove(id) {
      await withStore('readwrite', (store) => asPromise(store.delete(id)))
    },

    async list(entwurfId) {
      const rows = await withStore('readonly', (store) =>
        asPromise<Row[]>(store.index(ENTWURF_INDEX).getAll(entwurfId)),
      )
      return rows.map((row) => row.anlage)
    },

    async readDatei(id) {
      const row = await withStore('readonly', (store) =>
        asPromise<Row | undefined>(store.get(id)),
      )
      return row?.datei
    },
  }
}

export const anlagenStore = createAnlagenStore({
  storage: indexedDbStorage(),
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
})
