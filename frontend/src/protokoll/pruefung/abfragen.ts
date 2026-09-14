/* The cached history of one protocol.
 *
 * Its own key rather than a field on the protocol's, because the two change for
 * different reasons and at different moments: the answers move while somebody
 * types, the history moves when somebody decides. Sharing an entry would mean a
 * decision throwing away a document the form is still holding unsaved answers
 * over.
 *
 * The same arrangement entwurf/abfragen.ts uses, and for the same reason: one
 * shared definition, one cache entry, one request.
 */

import { queryOptions } from '@tanstack/react-query'
import { sollWiederholen } from '../entwurf/abfragen'
import { holeVerlauf } from './api'

/** Namespaced by id, so two protocols never share an entry. */
export function verlaufsKey(id: string) {
  return ['verlauf', id] as const
}

/* Deliberately not pinned the way the protocol's own document is.
 *
 * entwurfsAbfrage is never refetched behind the form's back, because the browser
 * holds answers the server has not seen and a refetch would replace them with
 * something older. Nothing here is unsaved: every entry was written by the
 * server, so refetching can only make it more correct, and a surveyor coming back
 * to a protocol should see a decision that was made in the meantime.
 */
export function verlaufsAbfrage(id: string | undefined) {
  return queryOptions({
    queryKey: verlaufsKey(id ?? ''),
    queryFn: () => (id === undefined ? Promise.reject(new Error('no id')) : holeVerlauf(id)),
    enabled: id !== undefined,
    retry: sollWiederholen,
  })
}
