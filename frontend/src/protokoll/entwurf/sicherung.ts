/* The copy of a protocol that stays in this browser when a save does not land.
 *
 * Feature 3b moved drafts to the server, which gave saving failure modes it did
 * not have while it was writing to localStorage: the network drops, the session
 * runs out, the backend is down, the laptop is shut mid-request. In every one of
 * those the surveyor has typed something that exists nowhere but the page they
 * are looking at, and a page is not a place to keep work.
 *
 * So a copy is written just before each save is sent and deleted as soon as the
 * server confirms one. That ordering is the whole design: a copy that is still
 * here is, by construction, work the server never acknowledged.
 *
 * This is a rescue, not storage and not a queue. It holds one protocol's answers
 * for as long as they are unsaved, it is offered back the next time that
 * protocol is opened, and nothing here ever retries a request on its own.
 * Offline working is feature 22.
 *
 * Storage, the clock and the id are arguments rather than globals, the same
 * arrangement the draft store used before it became api.ts, which is what makes
 * the failure modes below testable without a browser.
 */

import { browserStorage } from './browserSpeicher'
import type { Antworten } from './typen'

/** One key per protocol. Namespaced, because localStorage is shared. */
export const KEY_PREFIX = 'ffs-sicherung:'

export interface Sicherung {
  id: string
  /** The version the unsaved answers were being written against. */
  version: number
  antworten: Antworten
  /** When it was kept, so the offer to restore it can say. */
  zeitpunkt: string
}

export interface SicherungsStore {
  lies(id: string): Sicherung | null
  schreib(sicherung: Omit<Sicherung, 'zeitpunkt'>): void
  loesche(id: string): void
}

interface StoreOptions {
  storage: Storage
  now: () => string
}

/* A stored value is only trustworthy as far as it has been checked. Anything can
 * end up under our key: a half-written value from a killed tab, or a copy from an
 * older shape of this code. Nothing here parses into antworten, because a draft
 * is incomplete by definition and every answer in it is optional. */
function istSicherung(wert: unknown): wert is Sicherung {
  if (typeof wert !== 'object' || wert === null) return false
  const k = wert as Record<string, unknown>
  return (
    typeof k.id === 'string' &&
    typeof k.version === 'number' &&
    typeof k.zeitpunkt === 'string' &&
    typeof k.antworten === 'object' &&
    k.antworten !== null
  )
}

export function createSicherungsStore({ storage, now }: StoreOptions): SicherungsStore {
  return {
    /* Every read is wrapped, not only the JSON parse. Private browsing, blocked
       site data and a locked-down profile all make the accessor itself throw,
       and an unreadable copy means the same thing as an absent one. */
    lies(id) {
      try {
        const roh = storage.getItem(KEY_PREFIX + id)
        if (roh === null) return null
        const geparst: unknown = JSON.parse(roh)
        return istSicherung(geparst) ? geparst : null
      } catch {
        return null
      }
    },

    /* Failure is swallowed on purpose. This runs on the way into a save, and a
       browser that will not store the copy must not also stop the save that
       might well succeed. The save indicator reports what actually happened. */
    schreib(sicherung) {
      try {
        const mitZeit: Sicherung = { ...sicherung, zeitpunkt: now() }
        storage.setItem(KEY_PREFIX + sicherung.id, JSON.stringify(mitZeit))
      } catch {
        // Nothing to do about it here, and nothing worth saying twice.
      }
    },

    loesche(id) {
      try {
        storage.removeItem(KEY_PREFIX + id)
      } catch {
        // Same reasoning: a copy that cannot be removed is not worth a failure.
      }
    },
  }
}

/* Two documents holding the same answers.
 *
 * Needed because a safety copy is only worth offering back when it says
 * something the server does not. JSON.stringify would be shorter and wrong: the
 * order React Hook Form hands back its keys is the order fields were registered,
 * which is not the order the server stored them, so two identical documents
 * would compare as different and the offer would appear after every save.
 *
 * Undefined and a missing key are the same thing here. React Hook Form gives an
 * untouched group back as undefined while the server, having never been told
 * about it, simply has no key.
 */
export function gleicheAntworten(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  const links = a as Record<string, unknown>
  const rechts = b as Record<string, unknown>
  const schluessel = new Set([...Object.keys(links), ...Object.keys(rechts)])

  for (const s of schluessel) {
    const l = links[s]
    const r = rechts[s]
    if (l === undefined && r === undefined) continue
    if (typeof l === 'object' && l !== null && typeof r === 'object' && r !== null) {
      if (!gleicheAntworten(l, r)) return false
      continue
    }
    if (l !== r) return false
  }

  return true
}

export const sicherungsStore = createSicherungsStore({
  storage: browserStorage(),
  now: () => new Date().toISOString(),
})
