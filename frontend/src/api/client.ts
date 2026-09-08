/* The one place this app talks to its backend.
 *
 * Everything above it works in terms of typed answers and ApiFehler, and nobody
 * else writes a fetch. That is what keeps four things from being decided again
 * per call site: that the cookie is sent, that a refusal becomes a typed error
 * rather than a resolved promise nobody checked, that a body is JSON, and that
 * an unreadable answer is told apart from a working one.
 *
 * The URL is relative on purpose. In development vite.config.ts proxies /api to
 * the backend, and in production the reverse proxy serves both from one origin,
 * so the browser never sees a second origin and there is no CORS configuration
 * anywhere to be got wrong or quietly loosened later.
 */

import { ANTWORT_UNLESBAR, ApiFehler, NETZWERK_FEHLER } from './fehler'
import type { FehlerAntwort } from './typen'

const BASIS = '/api/v1'

export interface AnfrageOptionen {
  methode?: 'GET' | 'POST'
  /** Serialised as JSON. Leave it out for a request with no body. */
  koerper?: unknown
  /* Injected so the tests need no browser and no stubbed global, the same way
     the draft store takes its storage as an argument. Bound to globalThis
     because an unbound fetch throws "Illegal invocation" in a browser. */
  fetchImpl?: typeof fetch
}

function standardFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis)
}

/* A refusal turned into a typed error.
 *
 * The body is read defensively. A 502 from the reverse proxy is HTML, and a
 * crash before FastAPI's handler runs is not our shape either, and neither may
 * be presented to the person as though it were a considered refusal.
 */
async function ablehnung(antwort: Response): Promise<ApiFehler> {
  let koerper: unknown
  try {
    koerper = await antwort.json()
  } catch (ursache) {
    return new ApiFehler(ANTWORT_UNLESBAR, { status: antwort.status, ursache })
  }

  if (!istFehlerAntwort(koerper)) {
    return new ApiFehler(ANTWORT_UNLESBAR, { status: antwort.status })
  }

  return new ApiFehler(koerper.code, {
    status: antwort.status,
    nachricht: koerper.nachricht,
  })
}

function istFehlerAntwort(wert: unknown): wert is FehlerAntwort {
  if (typeof wert !== 'object' || wert === null) return false
  const kandidat = wert as Record<string, unknown>
  return typeof kandidat.code === 'string' && typeof kandidat.nachricht === 'string'
}

/* One API call.
 *
 * Resolves with the parsed answer, or throws an ApiFehler. It never resolves
 * with a failure: a caller that forgets to check is a caller that renders an
 * error object as though it were data, and TanStack Query's own error handling
 * is built on a rejected promise.
 *
 * T is undefined for a 204, which is what abmeldung answers.
 */
export async function apiAnfrage<T>(
  pfad: string,
  { methode = 'GET', koerper, fetchImpl = standardFetch() }: AnfrageOptionen = {},
): Promise<T> {
  let antwort: Response
  try {
    antwort = await fetchImpl(BASIS + pfad, {
      method: methode,
      /* The session cookie rides on same-origin requests, and this app only ever
         makes same-origin requests. Spelled out rather than left to the default
         so that it is visible next to the URL it applies to. */
      credentials: 'same-origin',
      headers: koerper === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
    })
  } catch (ursache) {
    /* fetch rejects only when nothing answered: no network, DNS failure, the
       backend not running. Every HTTP status, 500 included, resolves. */
    throw new ApiFehler(NETZWERK_FEHLER, { ursache })
  }

  if (!antwort.ok) throw await ablehnung(antwort)

  // 204 has no body at all, so asking for its JSON would throw.
  if (antwort.status === 204) return undefined as T

  try {
    return (await antwort.json()) as T
  } catch (ursache) {
    throw new ApiFehler(ANTWORT_UNLESBAR, { status: antwort.status, ursache })
  }
}
