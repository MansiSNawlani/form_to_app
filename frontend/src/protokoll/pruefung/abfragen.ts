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
import { sollWiederholen as sollListeWiederholen } from '../../api/wiederholen'
import { sollWiederholen } from '../entwurf/abfragen'
import type { Prueflistenabfrage } from '../pruefliste/parameter'
import { holeNachbarn, holeVerlauf, nachbarnParameter } from './api'

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

/* Keyed by the protocol and by the queue it was opened out of, because "the one
   after this" is a different answer in a differently filtered list.

   Built from what the request actually sends, not from the whole selection: the
   page number is carried in the address and is not part of the question, so
   keying on it would make one question two cache entries. */
export function nachbarnKey(id: string, abfrage: Prueflistenabfrage) {
  return ['nachbarn', id, nachbarnParameter(abfrage).toString()] as const
}

/* Who stands either side of this protocol, worked out once on arrival.
 *
 * **Frozen, and that is the feature rather than an optimisation.** The queue's
 * default is Offen, meaning the protocols nobody has decided on. A reviewer opens
 * the fourth of them, reads it and presses Annehmen, and it is no longer Offen:
 * the protocol they are standing on has just left the list it came from. Asked
 * again at that moment there would be no anchor left to count from and Naechstes
 * would go dead exactly when it is wanted. Left alone it still goes where it was
 * always going to go.
 *
 * Which is also why useUebergang.ts deliberately does not invalidate this.
 *
 * The queue's own retry rule rather than the protocol's: this call can be refused
 * for the wrong role, and a settled refusal is not worth asking twice.
 */
export function nachbarnAbfrage(id: string, abfrage: Prueflistenabfrage) {
  return queryOptions({
    queryKey: nachbarnKey(id, abfrage),
    queryFn: () => holeNachbarn(id, abfrage),
    retry: sollListeWiederholen,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
