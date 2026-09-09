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

/* Whether a failed read is worth trying again.
 *
 * Its own function so it can be tested without React and without a browser, the
 * arrangement coding-standards.md asks for wherever a wrong answer is possible.
 * Both wrong answers cost something: retrying a missing protocol makes the
 * not-found page slower before it says the same thing, and giving up on a
 * dropped request shows a failure to somebody whose next attempt would have
 * worked.
 */
export function sollWiederholen(anzahl: number, fehler: Error): boolean {
  if (fehler instanceof ApiFehler && fehler.code === PROTOKOLL_NICHT_GEFUNDEN) return false
  return anzahl < 2
}

export function entwurfsAbfrage(id: string | undefined) {
  return queryOptions({
    queryKey: entwurfsKey(id ?? ''),
    /* Narrowed rather than cast. enabled keeps the function from running without
       an id, but it does not narrow this closure, and a cast here would be a
       promise to the compiler that only the enabled flag keeps. */
    queryFn: () => (id === undefined ? Promise.reject(new Error('no id')) : holeEntwurf(id)),
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

    retry: sollWiederholen,
  })
}
