/* The cached account list, and how it is fetched.
 *
 * The same arrangement pruefliste/abfragen.ts uses: the query options in one
 * place, so the page and anything later that reads the same list share one cache
 * entry and one request rather than each fetching a copy of their own.
 */

import { queryOptions } from '@tanstack/react-query'
import { ApiFehler, KONTO_NICHT_GEFUNDEN } from '../../api/fehler'
import { sollWiederholen } from '../../api/wiederholen'
import { holeBenutzer, holeKonto } from './api'

/* A single entry, because the endpoint takes no parameters and there is only ever
 * one of this list. Deliberately unlike prueflisteKey, which is keyed by the whole
 * selection because two filter settings are two different questions.
 *
 * **Load-bearing for 16c and 16d.** Both write an account and then have to make
 * this list show the change. Exported so they invalidate the key this module
 * defines rather than retyping the string, which is how two halves of a cache come
 * to disagree.
 */
export const BENUTZER_KEY = ['benutzer'] as const

export function benutzerAbfrage() {
  return queryOptions({
    queryKey: BENUTZER_KEY,
    queryFn: holeBenutzer,
    retry: sollWiederholen,
  })
}

/* One account's own key, feature 16d.
 *
 * Built from BENUTZER_KEY so the list's key is a prefix of it. That is not
 * cosmetic: invalidating BENUTZER_KEY invalidates every account's entry with it,
 * which is what should happen, since a change to one account is a change to a row
 * of the list. The page still invalidates its own key as well, so the account in
 * hand is refreshed whether or not the list is being watched.
 */
export function kontoKey(id: string) {
  return [...BENUTZER_KEY, id] as const
}

export function kontoAbfrage(id: string) {
  return queryOptions({
    queryKey: kontoKey(id),
    queryFn: () => holeKonto(id),
    /* sollWiederholen, plus one answer only this query can get.
     *
     * An id that names no account will name none however many times it is asked
     * for, so retrying it three times with backoff only makes the page sit on
     * "wird geladen" for several seconds before saying so. The refusal is settled
     * in exactly the way ROLLE_FEHLT is, which is what sollWiederholen already
     * declines to retry.
     *
     * Decided here rather than in wiederholen.ts, because widening that module to
     * "any not-found is settled" would also change how a missing protocol behaves
     * on three other screens, which is not this feature's to change.
     */
    retry: (anzahl: number, fehler: Error) => {
      if (fehler instanceof ApiFehler && fehler.code === KONTO_NICHT_GEFUNDEN) return false
      return sollWiederholen(anzahl, fehler)
    },
  })
}
