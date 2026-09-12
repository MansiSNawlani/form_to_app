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
import type { FehlerAntwort, Verstoss } from './typen'

const BASIS = '/api/v1'

export interface AnfrageOptionen {
  /* PUT and DELETE arrived with feature 3b. A protocol is saved by replacing its
     whole answers document rather than merging into it, which is a PUT, and a
     draft can be thrown away, which is a DELETE. */
  methode?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /* Serialised as JSON, unless it is a FormData, which goes as it is. Leave it
     out for a request with no body.

     FormData arrived with feature 3d, which uploads a file. It is the one case
     where setting Content-Type by hand breaks the request: a multipart body is
     split by a boundary string the browser invents per request, and the header
     has to name that exact string. Writing the header ourselves would name no
     boundary at all and the backend would find no parts. */
  koerper?: unknown
  /* Injected so the tests need no browser and no stubbed global, the same way
     the draft store takes its storage as an argument. Bound to globalThis
     because an unbound fetch throws "Illegal invocation" in a browser. */
  fetchImpl?: typeof fetch
}

function standardFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis)
}

/* The statuses a proxy sends when it could not reach the service behind it.
 *
 * Worth telling apart from an ordinary failure. Stop the backend and nothing our
 * code sent was wrong: the answer is "the service is down, try shortly", and it
 * must never read as though a password were mistaken. fetch itself only rejects
 * when nothing at all answered, which is what happens with no network, so
 * without this a stopped backend behind a working proxy would be reported as an
 * answer we could not understand. */
const NICHT_ERREICHBAR = new Set([502, 503, 504])

/* A refusal turned into a typed error.
 *
 * The body is read defensively. A gateway's answer is HTML or plain text, and a
 * crash before FastAPI's own handler runs is not our shape either, and neither
 * may be presented to the person as though it were a considered refusal.
 */
async function ablehnung(antwort: Response): Promise<ApiFehler> {
  if (NICHT_ERREICHBAR.has(antwort.status)) {
    return new ApiFehler(NETZWERK_FEHLER, { status: antwort.status })
  }

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
    verstoesse: verstoesseAus(koerper),
  })
}

function istFehlerAntwort(wert: unknown): wert is FehlerAntwort {
  if (typeof wert !== 'object' || wert === null) return false
  const kandidat = wert as Record<string, unknown>
  return typeof kandidat.code === 'string' && typeof kandidat.nachricht === 'string'
}

/* The violation list, when the refusal carried one.
 *
 * Read as defensively as the body above it, and for the same reason: this is the
 * one refusal whose detail the screen draws rather than prints, so an entry
 * missing its path would render an empty row with nowhere to go. Anything that
 * is not a path and a key is dropped, and a refusal with nothing left is simply
 * one with no list, which the panel handles by falling back to the sentence.
 */
function verstoesseAus(koerper: FehlerAntwort): Verstoss[] | undefined {
  if (!Array.isArray(koerper.verstoesse)) return undefined

  const brauchbar = koerper.verstoesse.filter(
    (eintrag: unknown): eintrag is Verstoss =>
      typeof eintrag === 'object' &&
      eintrag !== null &&
      typeof (eintrag as Verstoss).pfad === 'string' &&
      typeof (eintrag as Verstoss).schluessel === 'string',
  )

  return brauchbar.length > 0 ? brauchbar : undefined
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
  /* A FormData travels untouched and sets no header of its own here. Everything
     else that is not undefined is JSON. */
  const istJson = koerper !== undefined && !(koerper instanceof FormData)

  const alsKoerper = (wert: unknown): BodyInit | undefined => {
    if (wert === undefined) return undefined
    return wert instanceof FormData ? wert : JSON.stringify(wert)
  }

  let antwort: Response
  try {
    antwort = await fetchImpl(BASIS + pfad, {
      method: methode,
      /* The session cookie rides on same-origin requests, and this app only ever
         makes same-origin requests. Spelled out rather than left to the default
         so that it is visible next to the URL it applies to. */
      credentials: 'same-origin',
      headers: istJson ? { 'Content-Type': 'application/json' } : undefined,
      body: alsKoerper(koerper),
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
