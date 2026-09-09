/* The cached protocol, and the one definition of how it is fetched.
 *
 * Two places need it and they must agree on the cache key, or the page would
 * fetch again the document the loader has just been handed. ProtokollSeite reads
 * it while rendering; the /protokolle/neu loader writes the freshly created
 * draft straight into it, before anything renders at all.
 *
 * The same arrangement auth/useSitzung.ts uses for sitzungsAbfrage, and for the
 * same reason: one shared definition, one cache entry, one request.
 */

import { queryOptions } from '@tanstack/react-query'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN } from '../../api/fehler'
import { holeEntwurf } from './api'

/** Namespaced by id, so two protocols never share an entry. */
export function entwurfsKey(id: string) {
  return ['entwurf', id] as const
}

export function entwurfsAbfrage(id: string | undefined) {
  return queryOptions({
    queryKey: entwurfsKey(id ?? ''),
    queryFn: () => holeEntwurf(id as string),
    enabled: id !== undefined,

    /* Never refetched behind the form's back.
     *
     * While a protocol is open, the browser holds answers the server has not
     * seen yet: everything typed since the last save. A background refetch would
     * put a staler document into the cache than the one on screen, and the
     * version travelling with it is what the next save claims to be working
     * from. React Hook Form reads its defaults once, so nothing visible would
     * change and the damage would be silent.
     *
     * Reopening the page is a fresh mount and fetches again, which is when a
     * change made elsewhere should be picked up. */
    staleTime: Infinity,
    refetchOnWindowFocus: false,

    /* A missing protocol is an answer, not a hiccup. Trying twice more only
       makes the not-found page slower before it says the same thing. Everything
       else is worth a retry, because a dropped request usually is. */
    retry: (anzahl: number, fehler: Error) =>
      !(fehler instanceof ApiFehler && fehler.code === PROTOKOLL_NICHT_GEFUNDEN) && anzahl < 2,
  })
}
