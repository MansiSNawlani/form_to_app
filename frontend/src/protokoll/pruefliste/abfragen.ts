/* The cached queue, and how it is fetched.
 *
 * The same arrangement entwurf/abfragen.ts uses: the query options in one place,
 * so the page and anything later that reads the same list share one cache entry
 * and one request rather than each fetching a copy of their own.
 */

import { queryOptions } from '@tanstack/react-query'
import { ApiFehler, NICHT_ANGEMELDET, ROLLE_FEHLT } from '../../api/fehler'
import { holePruefliste } from './api'
import { alsEndpunktParameter, type Prueflistenabfrage } from './parameter'

/* Keyed by the whole selection, so two different filter settings are two cache
 * entries and stepping back to a previous one shows it at once instead of
 * fetching it again.
 *
 * Deliberately unlike protokolleKey(), which is a single entry: that list takes
 * no parameters at all, so there is only ever one of it.
 *
 * The endpoint's own parameter string is the key rather than the selection
 * object, because two selections that ask the server the same question are the
 * same cached answer, and an object would make them two entries that happen to
 * hold identical rows.
 */
export function prueflisteKey(abfrage: Prueflistenabfrage) {
  return ['pruefliste', alsEndpunktParameter(abfrage).toString()] as const
}

/* Whether a failed read is worth trying again.
 *
 * Its own exported function so it can be held to its promise without React,
 * which is what coding-standards.md asks wherever a wrong answer is possible.
 * Both wrong answers cost something here. Retrying a refusal makes somebody wait
 * through three requests to be told the same no, and the message they are
 * waiting for is not even an error they can act on. Giving up on a dropped
 * request shows a failure to somebody whose next attempt would have worked.
 */
export function sollWiederholen(anzahl: number, fehler: Error): boolean {
  if (fehler instanceof ApiFehler) {
    // Both are settled answers about the caller rather than about the request.
    if (fehler.code === ROLLE_FEHLT || fehler.code === NICHT_ANGEMELDET) return false
  }
  return anzahl < 2
}

export function prueflisteAbfrage(abfrage: Prueflistenabfrage) {
  return queryOptions({
    queryKey: prueflisteKey(abfrage),
    queryFn: () => holePruefliste(abfrage),
    retry: sollWiederholen,

    /* Kept while the next page loads, so paging and filtering swap the rows in
       place instead of blanking the table and jumping the page back to the top
       under whoever was reading it. */
    placeholderData: (vorher) => vorher,
  })
}
