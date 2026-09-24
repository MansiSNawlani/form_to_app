/* The cached queue, and how it is fetched.
 *
 * The same arrangement entwurf/abfragen.ts uses: the query options in one place,
 * so the page and anything later that reads the same list share one cache entry
 * and one request rather than each fetching a copy of their own.
 */

import { queryOptions } from '@tanstack/react-query'
import { sollWiederholen } from '../../api/wiederholen'
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
