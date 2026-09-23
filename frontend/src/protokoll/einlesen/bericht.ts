/* What an import could not carry over, kept in this browser so the draft can
 * find it.
 *
 * An imported protocol arrives with three different things wrong with it, and
 * the backend deliberately keeps them apart because the person does something
 * different about each. The rules' violations already have a home: they are the
 * same shape a refused Absenden produces, so they go into absenden/gemerkt.ts
 * and the panel that project already has draws them, survives a reload with
 * them, and folds them by section, all without a line written here.
 *
 * The other two have no such home. An answer the file held that could not be
 * read is not a rule complaining, it is a value sitting in the protocol that
 * nobody has looked at. A photograph the file carries is not in the protocol at
 * all. Neither fits a Verstoss, so they get this.
 *
 * **Nothing here is ever deleted.** Dismissing the banner records that the
 * banner was read and nothing else. An unreadable date stays unreadable and a
 * missing photograph stays missing however many times the explanation has been
 * clicked away, and a list of outstanding work that one click destroys is the
 * exact failure AbsendeProbleme.tsx was reshaped on 2026-09-12 to stop.
 *
 * **It holds no answers.** Every entry is a field path from our own form
 * definition, a count and a version string, so nothing a surveyor typed is
 * written to disk here. That is what makes this cheap, unlike the safety copy in
 * entwurf/sicherung.ts, which holds the document itself and is careful for it.
 *
 * Storage and the clock are arguments rather than globals, the same arrangement
 * the safety copy and gemerkt.ts both use, which is what makes the failure modes
 * below testable without a browser.
 */

import { browserStorage } from '../entwurf/browserSpeicher'

/** One key per protocol. Namespaced, because localStorage is shared. */
export const KEY_PREFIX = 'ffs-einlesebericht:'

export interface GemerkterBericht {
  id: string
  /** When the import happened, so the banner can say. */
  zeitpunkt: string
  /* The version the **file** declared, never the protocol's. The protocol is
     stamped with the version this deployment serves, because every import is a
     new survey; this only says which template was filled in. */
  quellversion: string
  /** Field paths whose value could not be taken over, ready for verorte(). */
  unbrauchbar: string[]
  /** Pictures the file carries, which did not come with the answers. */
  bilder: number
  /* The banner has been read. Only the banner: see the note above about nothing
     here ever being deleted. */
  bannerGelesen: boolean
}

export interface Berichtstore {
  lies(id: string): GemerkterBericht | null
  schreib(id: string, bericht: Einlesebericht): void
  /* Mark the explanation as read. Deliberately not a delete: the unusable
     answers and the missing pictures outlive it. */
  bannerGelesen(id: string): void
}

/** The half of the endpoint's report this store keeps. */
export interface Einlesebericht {
  quellversion: string
  unbrauchbar: readonly string[]
  bilder: number
}

interface StoreOptions {
  storage: Storage
  now: () => string
}

/* A stored value is only trustworthy as far as it has been checked. Anything can
 * end up under our key: a half-written value from a killed tab, or one written
 * by an older shape of this code. A missing or wrong-typed field reads as absent
 * rather than throwing, because a banner that cannot be drawn must not take the
 * protocol down with it.
 */
function istBericht(wert: unknown): wert is GemerkterBericht {
  if (typeof wert !== 'object' || wert === null) return false
  const k = wert as Record<string, unknown>
  return (
    typeof k.id === 'string' &&
    typeof k.zeitpunkt === 'string' &&
    typeof k.quellversion === 'string' &&
    Array.isArray(k.unbrauchbar) &&
    typeof k.bilder === 'number'
  )
}

export function createBerichtstore({ storage, now }: StoreOptions): Berichtstore {
  /* Every read is wrapped, not only the JSON parse. Private browsing, blocked
     site data and a locked-down profile all make the accessor itself throw, and
     an unreadable report means the same thing as an absent one. */
  function rohLies(id: string): GemerkterBericht | null {
    try {
      const roh = storage.getItem(KEY_PREFIX + id)
      if (roh === null) return null
      const geparst: unknown = JSON.parse(roh)
      if (!istBericht(geparst)) return null

      return {
        ...geparst,
        /* Filtered rather than trusted: one bad entry costs its own line, not
           the whole report. */
        unbrauchbar: geparst.unbrauchbar.filter((pfad): pfad is string => typeof pfad === 'string'),
        /* A value written by an older shape of this code has no such field, and
           an unread banner is the safe reading: it shows once more rather than
           never. */
        bannerGelesen: geparst.bannerGelesen === true,
      }
    } catch {
      return null
    }
  }

  return {
    lies: rohLies,

    /* Failure is swallowed on purpose. A browser that will not store the report
       must not also break the import the person just did: the protocol is on the
       server with its answers in it either way, which is the part that matters. */
    schreib(id, bericht) {
      /* Every import is written down, including one with nothing wrong with it.
         The banner is the reason: somebody opening this protocol has to be told
         it came out of a PDF and is a draft nobody has submitted, and that is
         just as true of a file the rules were happy with. An import that worked
         must not be indistinguishable from one that quietly did nothing.
         
         It does not repeat forever, because bannerGelesen ends it at the click;
         what is deliberately not ended is the rest of the report. */
      try {
        const gemerkt: GemerkterBericht = {
          id,
          zeitpunkt: now(),
          quellversion: bericht.quellversion,
          unbrauchbar: [...bericht.unbrauchbar],
          bilder: bericht.bilder,
          bannerGelesen: false,
        }
        storage.setItem(KEY_PREFIX + id, JSON.stringify(gemerkt))
      } catch {
        // Nothing to do about it here, and nothing worth saying twice.
      }
    },

    bannerGelesen(id) {
      try {
        const gemerkt = rohLies(id)
        if (gemerkt === null) return

        storage.setItem(KEY_PREFIX + id, JSON.stringify({ ...gemerkt, bannerGelesen: true }))
      } catch {
        // A banner that cannot remember being read is a small loss, and not one
        // worth failing the click over.
      }
    },
  }
}

/** The one the app uses. Tests build their own with a storage they can inspect. */
export const berichtstore = createBerichtstore({
  storage: browserStorage(),
  now: () => new Date().toISOString(),
})
