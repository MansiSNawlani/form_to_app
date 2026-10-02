/* What went wrong with an API call, and what to say about it.
 *
 * Every failure the client can produce arrives as an ApiFehler carrying a code.
 * Code, not sentence: backend/app/api/fehler_http.py publishes
 * ANMELDUNG_FEHLGESCHLAGEN, NICHT_ANGEMELDET and the rest precisely so the
 * browser can branch on something a reword cannot break. Feature 2c's guard
 * branches on NICHT_ANGEMELDET, and features 11 and 16 will branch on ROLLE_FEHLT.
 */

import type { ParseKeys } from 'i18next'
import de from '../i18n/locales/de.json'
import type { Fehlerwert, Verstoss } from './typen'

/** The server could not be reached at all. Ours, not the backend's. */
export const NETZWERK_FEHLER = 'NETZWERK_FEHLER'

/** Something answered, but not in the shape this API promises. Also ours. */
export const ANTWORT_UNLESBAR = 'ANTWORT_UNLESBAR'

/** Not signed in, or the session has run out. Published by the backend. */
export const NICHT_ANGEMELDET = 'NICHT_ANGEMELDET'

/* Signed in, but this account has no business at this address.
 *
 * Published by the backend since feature 2b, and named here in feature 12b, which
 * is the first screen that branches on it: the Pruefliste is refused to anybody
 * who is not FFS staff, and the way out of that refusal is a link rather than a
 * retry. It is also settled, so retrying it only makes the refusal slower to
 * appear.
 */
export const ROLLE_FEHLT = 'ROLLE_FEHLT'

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

/* The protocol has already left the surveyor's hands, so it cannot be sent, saved
 * or deleted. Branched on by Absenden, which answers it with a way onward to the
 * list rather than with the backend's save-oriented sentence: somebody who
 * pressed the button twice, or whose first answer was lost on the way back, has
 * not made a mistake and has nothing to repair.
 */
export const PROTOKOLL_NICHT_MEHR_ENTWURF = 'PROTOKOLL_NICHT_MEHR_ENTWURF'

/* No constants for the attachment refusals, deliberately, added in feature 3d.
 *
 * The backend publishes ANLAGE_TYP_UNZULAESSIG, ANLAGE_INHALT_KEIN_BILD,
 * ANLAGE_ZU_GROSS, ANLAGENART_VOLL and ANLAGE_NICHT_GEFUNDEN, and every one of
 * them arrives with a German sentence that already names the file, says why in
 * ordinary words and says what to do about it. Nothing in the browser has to
 * tell them apart to show them, so naming them here would be five exports
 * nothing imports.
 *
 * The moment something does branch on one, it gets its constant, like the two
 * above.
 */

/* The protocol was not sent, because something is missing or wrong in it.
 *
 * The one refusal in this API that carries structured detail rather than only a
 * sentence, and the reason ApiFehler has a verstoesse field at all: the form
 * draws this as a panel listing each problem beside the field it concerns, which
 * a sentence cannot do. Branched on in protokoll/absenden/, which is why it has
 * a constant where the attachment refusals below deliberately do not.
 */
export const PROTOKOLL_UNVOLLSTAENDIG = 'PROTOKOLL_UNVOLLSTAENDIG'

/* The protocol is not in a state this step is possible from, added in feature
 * 11d. Usually two reviewers with the same protocol open, or one who left the
 * page sitting since yesterday. Nothing the person did wrong, and nothing that
 * trying again can fix: the screen has to fetch the protocol afresh.
 */
export const UEBERGANG_NICHT_MOEGLICH = 'UEBERGANG_NICHT_MOEGLICH'

/* No account with that id, added in feature 16d.
 *
 * Branched on because the way out of it is a link to the list rather than a retry:
 * an id that names no account will name none however many times it is asked for.
 *
 * Unlike PROTOKOLL_NICHT_GEFUNDEN this really does mean "there is no such row".
 * The backend can afford to say so because every route that raises it is behind
 * SUPER_ADMIN, which is the argument written at the top of app/api/fehler_http.py:
 * to an unauthenticated caller a 404 would be a way of finding out which addresses
 * hold an account here.
 */
export const KONTO_NICHT_GEFUNDEN = 'KONTO_NICHT_GEFUNDEN'

/* A rejection or a change request arrived without a reason.
 *
 * The one refusal in the workflow a reviewer puts right by typing, so the screen
 * branches on it to put the message beside the Begruendung box rather than at the
 * top of the page. The others are about the protocol; this one is about the form
 * in front of them.
 */
export const BEGRUENDUNG_FEHLT = 'BEGRUENDUNG_FEHLT'

/* Somebody tried to decide on a protocol they filed themselves.
 *
 * Chosen with the user on 2026-09-14. Branched on because the way out is a person
 * rather than an action: somebody else has to decide, and the screen says so
 * instead of offering a button that cannot work.
 */
export const EIGENES_PROTOKOLL = 'EIGENES_PROTOKOLL'

export interface FehlerOptionen {
  /** The HTTP status, or null when nothing ever answered. */
  status?: number
  /** The backend's own German sentence, when it sent one. */
  nachricht?: string
  ursache?: unknown
  /* What is missing or wrong, when the backend said. Empty for every refusal but
     a refused submit. */
  verstoesse?: readonly Verstoss[]
  /** The values the sentence names, when the backend sent any. */
  werte?: Readonly<Record<string, Fehlerwert>>
}

export class ApiFehler extends Error {
  readonly code: string
  readonly status: number | null
  readonly nachricht: string | null
  /** Empty for every refusal but a refused submit. */
  readonly verstoesse: readonly Verstoss[]
  readonly werte: Readonly<Record<string, Fehlerwert>>

  constructor(code: string, optionen: FehlerOptionen = {}) {
    /* The Error message is for a stack trace and a console, never for a person.
       What the person reads comes out of fehlertext below, which is the only
       thing that knows about translation. */
    super(`API-Fehler ${code}`, { cause: optionen.ursache })
    this.name = 'ApiFehler'
    this.code = code
    this.status = optionen.status ?? null
    this.nachricht = optionen.nachricht ?? null
    this.verstoesse = optionen.verstoesse ?? []
    this.werte = optionen.werte ?? {}
  }
}

/* The two failures the backend never sees, so nobody but us can describe them. */
const EIGENE_TEXTE: Partial<Record<string, ParseKeys>> = {
  [NETZWERK_FEHLER]: 'fehler.netzwerk',
  [ANTWORT_UNLESBAR]: 'fehler.unlesbar',
}

/* What to show a person about a failure.
 *
 * A key or a sentence rather than finished text, so this stays a plain function
 * with no i18n inside it, the same shape regeln/regel.ts uses for the form
 * rules. The component translates the key with its werte; a sentence is the
 * backend's own German, shown as it stands.
 */
export type Fehlertext =
  | { art: 'schluessel'; schluessel: ParseKeys; werte?: Readonly<Record<string, Fehlerwert>> }
  | { art: 'text'; text: string }

const UNBEKANNT: Fehlertext = { art: 'schluessel', schluessel: 'fehler.unbekannt' }

/* The server's refusals in our own words, since feature 17e, keyed by code.
 *
 * Read from de.json because German is the source locale: a key exists there
 * before it exists anywhere, and locales.test.ts holds en.json to the same set.
 * A parameter so a test can hand in texts of its own without a locale file.
 */
const SERVER_TEXTE: Readonly<Record<string, string>> = de.fehler.server

function platzhalter(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((treffer) => treffer[1])
}

/* The key for a code, or null when the backend's sentence has to stand in.
 *
 * Two things make a key unusable. The locale file has no wording for the code,
 * which is every code added to the API after the locale files were last
 * written. Or the wording names a value the refusal did not carry, and a raw
 * "{{dateiname}}" on screen reads as broken where German at least reads.
 *
 * ANLAGENART_VOLL picks its sentence by art, for the reason ART_SATZ in
 * backend/app/api/fehler_http.py gives: one photo too many and a second map
 * excerpt are different sentences with different ways out.
 */
function serverSchluessel(fehler: ApiFehler, texte: Readonly<Record<string, string>>): string | null {
  const art = fehler.werte.art
  const name = typeof art === 'string' ? `${fehler.code}_${art}` : fehler.code
  const text = texte[name]
  if (text === undefined) return null

  return platzhalter(text).every((wert) => wert in fehler.werte) ? name : null
}

/* What the server said, in our words where we have them: null when it said
 * nothing a person could read.
 *
 * Exported for the attachment block, which has wording of its own for a file
 * that never reached the server and wants only this half.
 */
export function servertext(fehler: ApiFehler, texte = SERVER_TEXTE): Fehlertext | null {
  const server = serverSchluessel(fehler, texte)
  if (server !== null) {
    /* Built at run time, so the compiler cannot see it is one of the keys;
       serverSchluessel has just found it in the locale file. */
    return { art: 'schluessel', schluessel: `fehler.server.${server}` as ParseKeys, werte: fehler.werte }
  }

  /* A code we have no wording for still says something useful, because the
     backend sent a sentence written to this project's standard. That holds for a
     code added to the API after the locale files were last written, which is the
     case a generic message would serve worst. */
  return fehler.nachricht !== null ? { art: 'text', text: fehler.nachricht } : null
}

export function fehlertext(fehler: unknown, texte = SERVER_TEXTE): Fehlertext {
  if (fehler instanceof ApiFehler) {
    const schluessel = EIGENE_TEXTE[fehler.code]
    if (schluessel !== undefined) return { art: 'schluessel', schluessel }

    const text = servertext(fehler, texte)
    if (text !== null) return text
  }

  /* Anything that is not an ApiFehler at all lands here: a bug in our own code,
     or whatever a library threw. There is nothing truthful to say about it
     beyond that it happened. */
  return UNBEKANNT
}
