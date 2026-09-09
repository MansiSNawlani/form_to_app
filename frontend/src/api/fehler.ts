/* What went wrong with an API call, and what to say about it.
 *
 * Every failure the client can produce arrives as an ApiFehler carrying a code.
 * Code, not sentence: backend/app/api/fehler_http.py publishes
 * ANMELDUNG_FEHLGESCHLAGEN, NICHT_ANGEMELDET and the rest precisely so the
 * browser can branch on something a reword cannot break. Feature 2c's guard
 * branches on NICHT_ANGEMELDET, and features 11 and 16 will branch on ROLLE_FEHLT.
 */

import type { ParseKeys } from 'i18next'

/** The server could not be reached at all. Ours, not the backend's. */
export const NETZWERK_FEHLER = 'NETZWERK_FEHLER'

/** Something answered, but not in the shape this API promises. Also ours. */
export const ANTWORT_UNLESBAR = 'ANTWORT_UNLESBAR'

/** Not signed in, or the session has run out. Published by the backend. */
export const NICHT_ANGEMELDET = 'NICHT_ANGEMELDET'

/* No such protocol, or one belonging to somebody else. Published by the backend,
 * which deliberately answers the same way to both: telling them apart would let
 * a stranger discover which ids exist. */
export const PROTOKOLL_NICHT_GEFUNDEN = 'PROTOKOLL_NICHT_GEFUNDEN'

/* The protocol moved on since the save being attempted was working from, so
 * nothing was written. The same protocol open in two places, which
 * protokoll/anlagen/store.ts already records as ordinary here rather than an
 * edge case. Feature 3b gives it a state of its own on screen, because it is the
 * one save failure where trying again cannot help. */
export const PROTOKOLL_VERAENDERT = 'PROTOKOLL_VERAENDERT'

export interface FehlerOptionen {
  /** The HTTP status, or null when nothing ever answered. */
  status?: number
  /** The backend's own German sentence, when it sent one. */
  nachricht?: string
  ursache?: unknown
}

export class ApiFehler extends Error {
  readonly code: string
  readonly status: number | null
  readonly nachricht: string | null

  constructor(code: string, optionen: FehlerOptionen = {}) {
    /* The Error message is for a stack trace and a console, never for a person.
       What the person reads comes out of fehlertext below, which is the only
       thing that knows about translation. */
    super(`API-Fehler ${code}`, { cause: optionen.ursache })
    this.name = 'ApiFehler'
    this.code = code
    this.status = optionen.status ?? null
    this.nachricht = optionen.nachricht ?? null
  }
}

/* The codes we have wording of our own for.
 *
 * Both are failures the backend never sees, so nobody but us can describe them.
 * Every other code keeps the backend's sentence, which already names the thing,
 * says why and says what to do next. Writing a second German copy of those here
 * would mean two wordings drifting apart, and the backend's is the one the API
 * documentation shows.
 *
 * Feature 17 is where this table grows. Adding a backend code here overrides its
 * sentence with a translated key, and needs no backend change to do it, which is
 * the whole reason the branch goes through the code.
 */
const EIGENE_TEXTE: Partial<Record<string, ParseKeys>> = {
  [NETZWERK_FEHLER]: 'fehler.netzwerk',
  [ANTWORT_UNLESBAR]: 'fehler.unlesbar',
}

/* What to show a person about a failure.
 *
 * A key or a sentence rather than finished text, so this stays a plain function
 * with no i18n inside it, the same shape regeln/regel.ts uses for the form
 * rules. The component translates the key; the sentence is already German and
 * comes from the backend.
 */
export type Fehlertext =
  | { art: 'schluessel'; schluessel: ParseKeys }
  | { art: 'text'; text: string }

const UNBEKANNT: Fehlertext = { art: 'schluessel', schluessel: 'fehler.unbekannt' }

export function fehlertext(fehler: unknown): Fehlertext {
  if (fehler instanceof ApiFehler) {
    const schluessel = EIGENE_TEXTE[fehler.code]
    if (schluessel !== undefined) return { art: 'schluessel', schluessel }

    /* An error we have no wording for still says something useful, because the
       backend sent a sentence written to this project's standard. That holds for
       a code added to the API after this file was last read, which is the case
       a generic message would serve worst. */
    if (fehler.nachricht !== null) return { art: 'text', text: fehler.nachricht }
  }

  /* Anything that is not an ApiFehler at all lands here: a bug in our own code,
     or whatever a library threw. There is nothing truthful to say about it
     beyond that it happened. */
  return UNBEKANNT
}
