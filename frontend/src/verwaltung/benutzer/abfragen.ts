/* The cached account list, and how it is fetched.
 *
 * The same arrangement pruefliste/abfragen.ts uses: the query options in one
 * place, so the page and anything later that reads the same list share one cache
 * entry and one request rather than each fetching a copy of their own.
 */

import { queryOptions } from '@tanstack/react-query'
import { sollWiederholen } from '../../api/wiederholen'
import { holeBenutzer } from './api'

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
