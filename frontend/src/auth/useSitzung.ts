/* Who is signed in, and how to change that.
 *
 * The browser cannot read the session cookie, because feature 2b made it
 * httpOnly on purpose. So the page cannot look up whether it is signed in; it
 * has to ask, and GET /api/v1/ich is that question. The answer, cached here, is
 * the whole of this app's session state.
 *
 * useSitzung is the only sanctioned way a component learns who is signed in. A
 * screen that calls /ich for itself is a screen that will one day disagree with
 * the header, and features 3, 11, 12, 13 and 16 all need this same answer.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiAnfrage } from '../api/client'
import { ApiFehler, NICHT_ANGEMELDET } from '../api/fehler'
import type { AnmeldungAnfrage, BenutzerAntwort } from '../api/typen'

/** The one cache entry holding the account. Exported so a test can seed it. */
export const SITZUNGS_KEY = ['sitzung'] as const

/* Three states, and the third one matters as much as the other two.
 *
 * Before the first answer arrives we know neither, and a guard that treats
 * "do not know yet" as "signed out" shows a signed-in person a login page for a
 * moment on every single reload. */
export type Sitzung =
  | { zustand: 'wird_geprueft' }
  | { zustand: 'angemeldet'; benutzer: BenutzerAntwort }
  | { zustand: 'abgemeldet' }

/* Not signed in is an answer, not a failure.
 *
 * Letting the 401 stay an error would make the ordinary case of arriving at the
 * app signed out look identical to the backend being down, and the two need
 * different handling: one sends you to the login page, the other tells you the
 * server cannot be reached.
 */
async function ladeSitzung(): Promise<BenutzerAntwort | null> {
  try {
    return await apiAnfrage<BenutzerAntwort>('/ich')
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.code === NICHT_ANGEMELDET) return null
    throw fehler
  }
}

/* The query itself, apart from the hook, because two callers need it.
 *
 * The guard reads it through useSitzung while rendering. The loader on
 * /protokolle/neu reads it before rendering happens at all, since that loader
 * creates a draft and must not do so for somebody who is not signed in. Sharing
 * the definition means both see one cache entry and one request, rather than the
 * loader quietly fetching a second copy under a key of its own.
 */
export const sitzungsAbfrage = {
  queryKey: SITZUNGS_KEY,
  queryFn: ladeSitzung,
  /* A 401 is a real answer, not a hiccup, and ladeSitzung has already turned it
     into one. What is left to retry is a backend that is down, and trying twice
     more only makes a signed-out page load slower before it says the same
     thing. */
  retry: false,
} as const

export function useSitzung(): Sitzung {
  const { data, isPending, isError } = useQuery(sitzungsAbfrage)

  if (isPending) return { zustand: 'wird_geprueft' }

  /* An error here means the question could not be asked at all, so no session
     could be established. Treated as signed out, which sends the person to the
     login page, where step 6 says plainly that the server is unreachable rather
     than pretending their password was wrong. Nothing is lost by that: drafts
     live in this browser, and the guard carries the page they were on. */
  if (isError || data === null) return { zustand: 'abgemeldet' }

  return { zustand: 'angemeldet', benutzer: data }
}

/* Signing in writes the account straight into the cache.
 *
 * The sign-in response already carries the account, so invalidating the query
 * instead would send a second request to /ich for something we are holding. */
export function useAnmeldung() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (anfrage: AnmeldungAnfrage) =>
      apiAnfrage<BenutzerAntwort>('/anmeldung', { methode: 'POST', koerper: anfrage }),
    onSuccess: (benutzer) => {
      queryClient.setQueryData(SITZUNGS_KEY, benutzer)
    },
  })
}

export function useAbmeldung() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiAnfrage<undefined>('/abmeldung', { methode: 'POST' }),
    onSuccess: () => {
      /* Everything, not only the session. From feature 3 onward this cache holds
         submissions, and leaving one person's data in it for the next person to
         sign in on the same computer is exactly the mistake worth making
         structurally impossible now, while the cache is still empty.

         Cleared first, then the session set, because clear() would otherwise
         throw away the very entry that tells the guard to show the login page. */
      queryClient.clear()
      queryClient.setQueryData(SITZUNGS_KEY, null)
    },
  })
}
