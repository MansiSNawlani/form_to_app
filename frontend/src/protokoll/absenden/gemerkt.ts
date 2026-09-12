/* The last refusal, kept in this browser so a reload does not lose it.
 *
 * A protocol that cannot be submitted comes back with up to sixty things to put
 * right, and putting them right takes a while: several sections, a look at field
 * notes, sometimes a second person. A reload in the middle of that threw the
 * whole list away and left nothing to say what was wrong, which Mansi found on
 * 2026-09-12. Pressing Absenden again would fetch it afresh, but only after
 * pressing a button whose answer you already had.
 *
 * **Only in this browser, deliberately.** The list is not a record of anything:
 * it is what the server said at one moment about a document that is still being
 * written, and the server can say it again at any time. Storing it on the server
 * would mean a second thing to keep in step with the protocol, and a protocol is
 * the thing that matters.
 *
 * **It holds no answers.** Every entry is a field path from our own form
 * definition and a message key, so nothing a surveyor typed is written to disk
 * here, unlike the safety copy in entwurf/sicherung.ts, which is exactly what
 * makes that one worth its care and this one cheap.
 *
 * Storage and the clock are arguments rather than globals, the same arrangement
 * the safety copy uses, which is what makes the failure modes below testable
 * without a browser.
 */

import { browserStorage } from '../entwurf/browserSpeicher'
import type { Verstoss } from '../../api/typen'

/** One key per protocol. Namespaced, because localStorage is shared. */
export const KEY_PREFIX = 'ffs-absendepruefung:'

export interface GemerktePruefung {
  id: string
  /** When the server said this, so the panel can admit how old it is. */
  zeitpunkt: string
  verstoesse: Verstoss[]
}

export interface PruefungsStore {
  lies(id: string): GemerktePruefung | null
  schreib(id: string, verstoesse: readonly Verstoss[]): void
  loesche(id: string): void
}

interface StoreOptions {
  storage: Storage
  now: () => string
}

/* A stored value is only trustworthy as far as it has been checked. Anything can
 * end up under our key: a half-written value from a killed tab, or one written by
 * an older shape of this code. An entry missing either half is dropped rather
 * than the whole list, since the rest is still worth showing.
 */
function istVerstoss(wert: unknown): wert is Verstoss {
  if (typeof wert !== 'object' || wert === null) return false
  const k = wert as Record<string, unknown>
  return typeof k.pfad === 'string' && typeof k.schluessel === 'string'
}

function istPruefung(wert: unknown): wert is GemerktePruefung {
  if (typeof wert !== 'object' || wert === null) return false
  const k = wert as Record<string, unknown>
  return (
    typeof k.id === 'string' && typeof k.zeitpunkt === 'string' && Array.isArray(k.verstoesse)
  )
}

export function createPruefungsStore({ storage, now }: StoreOptions): PruefungsStore {
  return {
    /* Every read is wrapped, not only the JSON parse. Private browsing, blocked
       site data and a locked-down profile all make the accessor itself throw, and
       an unreadable list means the same thing as an absent one: press Absenden. */
    lies(id) {
      try {
        const roh = storage.getItem(KEY_PREFIX + id)
        if (roh === null) return null
        const geparst: unknown = JSON.parse(roh)
        if (!istPruefung(geparst)) return null

        const verstoesse = geparst.verstoesse.filter(istVerstoss)
        return verstoesse.length > 0 ? { ...geparst, verstoesse } : null
      } catch {
        return null
      }
    },

    /* Failure is swallowed on purpose. A browser that will not store the list
       must not also break the refusal the person needs to read; they simply get
       it again the next time they press the button. */
    schreib(id, verstoesse) {
      try {
        const gemerkt: GemerktePruefung = { id, zeitpunkt: now(), verstoesse: [...verstoesse] }
        storage.setItem(KEY_PREFIX + id, JSON.stringify(gemerkt))
      } catch {
        // Nothing to do about it here, and nothing worth saying twice.
      }
    },

    loesche(id) {
      try {
        storage.removeItem(KEY_PREFIX + id)
      } catch {
        // Same reasoning: a list that cannot be removed is not worth a failure.
      }
    },
  }
}

/** The one the app uses. Tests build their own with a storage they can inspect. */
export const pruefungsStore = createPruefungsStore({
  storage: browserStorage(),
  now: () => new Date().toISOString(),
})
