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
  /* grund is how we came to be signed out, and only two things read it. The
     login page uses it to decide whether to explain, and it must never blame an
     expired session for what was really an unreachable server. 'antwort' means
     the backend said so; 'fehler' means it could not be asked. */
  | { zustand: 'abgemeldet'; grund: 'antwort' | 'fehler' }

/* Not signed in is an answer, not a failure.
 *
 * Letting the 401 stay an error would make the ordinary case of arriving at the
 * app signed out look identical to the backend being down, and the two need
 * different handling: one sends you to the login page, the other tells you the
 * server cannot be reached.
 */
/* Whether a session has existed in this tab and then gone away.
 *
 * It is what tells being thrown out of a half-filled protocol apart from
 * arriving at a locked door, so the login page can explain the first and stay
 * quiet about the second.
 *
 * A module variable rather than React state or a ref, because it belongs to the
 * session rather than to any component: the guard reads it, and the only two
 * things that change it are the two places a session begins and ends. It is
 * cleared on a deliberate sign-out, so somebody who signs out and then walks
 * back into the app is not told their session expired when they ended it
 * themselves.
 */
let sitzungBestand = false

export function sitzungIstWeggefallen(): boolean {
  return sitzungBestand
}

async function ladeSitzung(): Promise<BenutzerAntwort | null> {
  try {
    const benutzer = await apiAnfrage<BenutzerAntwort>('/ich')
    sitzungBestand = true
    return benutzer
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

/* The mapping from what the cache holds to what a screen needs to know.
 *
 * Pulled out of the hook so it can be tested without React or a browser, which
 * is what coding-standards.md asks of logic where a wrong answer is possible.
 * Two wrong answers are possible here and both matter: calling a session that is
 * still being checked "signed out" flashes the login page at somebody who is
 * signed in, and calling an unreachable server "signed out" then tells them
 * their session expired when it did not.
 */
export function sitzungAus(zustand: {
  isPending: boolean
  isError: boolean
  data: BenutzerAntwort | null | undefined
}): Sitzung {
  if (zustand.isPending) return { zustand: 'wird_geprueft' }

  /* The question could not be asked at all, so no session could be established.
     Signed out for the purpose of what may be shown, but for a different reason,
     and the reason travels because the two need different words. */
  if (zustand.isError) return { zustand: 'abgemeldet', grund: 'fehler' }

  if (zustand.data === null || zustand.data === undefined) {
    return { zustand: 'abgemeldet', grund: 'antwort' }
  }

  return { zustand: 'angemeldet', benutzer: zustand.data }
}

export function useSitzung(): Sitzung {
  const { data, isPending, isError } = useQuery(sitzungsAbfrage)

  return sitzungAus({ isPending, isError, data })
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
      sitzungBestand = true
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

      /* Ending it yourself is not the same as it running out, so somebody who
         signs out and then walks back into the app is shown the plain login
         page rather than told their session expired. */
      sitzungBestand = false
    },
  })
}
