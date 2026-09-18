/* What the address bar says the review queue is.
 *
 * Plain values in and out: no React, no fetch, no i18next. The screen reads a
 * URLSearchParams through abfrageAus, hands one back through alsSuchparameter,
 * and the request is built by alsEndpunktParameter. Every one of them has a
 * wrong answer available to it, which is what coding-standards.md asks be kept
 * testable without a browser.
 *
 * **The address bar is this screen's state, and that is load-bearing.** Holding
 * the filters in a component instead would work today and break feature 12d:
 * Vorheriges and Naechstes have to rebuild this exact list from a protocol's URL
 * alone, and a filter living in a component would make "the protocol before this
 * one" depend on what the reviewer happened to click earlier. It also means a
 * reload comes back to the same list and a filtered queue can be sent as a link.
 *
 * A value out of the address bar is untrusted input, the same rule auth/weiter.ts
 * already states and tests. Anything unrecognised becomes the default rather than
 * being passed on: sent to the endpoint it would be answered with a 422, and a
 * hand-edited address would look like a broken page.
 */

/* The six states the queue may be asked for, exactly as Pruefstatus in
   backend/app/api/schemas.py spells them. DRAFT is not among them: the queue
   lists work that has been handed in, and the endpoint refuses to be asked. */
export const PRUEFSTATUS = [
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_CHANGES',
  'REJECTED',
  'ACCEPTED',
  'LOCKED',
] as const

export type Pruefstatus = (typeof PRUEFSTATUS)[number]

/* The protocols nobody has decided on yet, which is what a work queue is for.
 *
 * The endpoint takes status repeatably precisely so this screen can ask for both
 * at once. It is offered as a named entry in the dropdown rather than applied
 * quietly, because a queue that hides rows without saying so reads as a database
 * with protocols missing from it. */
export const OFFEN = ['SUBMITTED', 'IN_REVIEW'] as const

/** What the Status dropdown offers: the open pair, everything, or one state. */
export type Statuswahl = 'offen' | 'alle' | Pruefstatus

/* The four orders Sortierung in backend/app/protokolle/pruefliste/dienst.py
   declares, and no others. A fifth here would be a sort the server has not got,
   which is a control that silently does nothing. */
export const SORTIERUNGEN = [
  'eingereicht_alt',
  'eingereicht_neu',
  'datum_neu',
  'gewaesser',
] as const

export type Sortierung = (typeof SORTIERUNGEN)[number]

/* Mirrors SEITE_MAX in backend/app/protokolle/pruefliste/parameter.py. Clamped
   here as well as there so a silly number in the address bar never becomes a
   request at all. */
const SEITE_MAX = 1_000_000

/* The years a date can express, as the backend's JAHR_MIN and JAHR_MAX have
   them. Not a statement about how old a Befischung may be: it is what keeps a
   nonsense year out of a request the endpoint would refuse. Which years the
   dropdown offers is a separate and narrower question. */
const JAHR_MIN = 1
const JAHR_MAX = 9999

/** The whole of what this screen is showing, as values. */
export interface Prueflistenabfrage {
  status: Statuswahl
  anlass: string | null
  jahr: number | null
  /** As typed, untrimmed. Trimmed on the way to the endpoint, not on the way in. */
  suche: string
  /** One species export code, as the catch table stores it, e.g. "HECH". */
  art: string | null
  sortierung: Sortierung
  seite: number
}

/** Nothing narrowed, longest wait first, page one. */
export const STANDARD: Prueflistenabfrage = {
  status: 'offen',
  anlass: null,
  jahr: null,
  suche: '',
  art: null,
  sortierung: 'eingereicht_alt',
  seite: 1,
}

function begrenzeSeite(seite: number): number {
  if (!Number.isFinite(seite)) return 1
  return Math.min(Math.max(Math.floor(seite), 1), SEITE_MAX)
}

function statusAus(roh: string | null): Statuswahl {
  if (roh === 'alle') return 'alle'
  return (PRUEFSTATUS as readonly string[]).includes(roh ?? '')
    ? (roh as Pruefstatus)
    : STANDARD.status
}

function sortierungAus(roh: string | null): Sortierung {
  return (SORTIERUNGEN as readonly string[]).includes(roh ?? '')
    ? (roh as Sortierung)
    : STANDARD.sortierung
}

function jahrAus(roh: string | null): number | null {
  if (roh === null) return null

  const jahr = Number(roh)
  if (!Number.isInteger(jahr) || jahr < JAHR_MIN || jahr > JAHR_MAX) return null
  return jahr
}

function seiteAus(roh: string | null): number {
  if (roh === null) return STANDARD.seite

  const seite = Number(roh)
  return Number.isNaN(seite) ? STANDARD.seite : begrenzeSeite(seite)
}

/* The species, or nothing.
 *
 * The code is not checked against the form's list. The picker can only offer
 * real ones, and a list belongs to a form version: a protocol frozen on an older
 * one may legitimately name a code today's list no longer carries, and the
 * endpoint answers an unknown code with an empty page rather than a refusal.
 * Whitespace alone is nobody's choice and becomes no filter, the same as an empty
 * search box.
 */
function artAus(roh: string | null): string | null {
  return roh === null || roh.trim() === '' ? null : roh.trim()
}

function sucheAus(roh: string | null): string {
  // Whitespace alone is the same as no search, so a box somebody tabbed through
  // does not narrow the queue to nothing.
  return roh === null || roh.trim() === '' ? '' : roh
}

/** The address bar, read as a selection. */
export function abfrageAus(parameter: URLSearchParams): Prueflistenabfrage {
  return {
    status: statusAus(parameter.get('status')),
    anlass: parameter.get('anlass'),
    jahr: jahrAus(parameter.get('jahr')),
    suche: sucheAus(parameter.get('suche')),
    art: artAus(parameter.get('art')),
    sortierung: sortierungAus(parameter.get('sortierung')),
    seite: seiteAus(parameter.get('seite')),
  }
}

/* The selection, as the address bar should carry it.
 *
 * Everything at its default is left out, so the plain queue has no query string
 * at all and a shared link says only what was actually narrowed.
 */
export function alsSuchparameter(abfrage: Prueflistenabfrage): URLSearchParams {
  const parameter = new URLSearchParams()

  if (abfrage.status !== STANDARD.status) parameter.set('status', abfrage.status)
  if (abfrage.anlass !== null) parameter.set('anlass', abfrage.anlass)
  if (abfrage.jahr !== null) parameter.set('jahr', String(abfrage.jahr))
  if (abfrage.suche !== '') parameter.set('suche', abfrage.suche)
  if (abfrage.art !== null) parameter.set('art', abfrage.art)
  if (abfrage.sortierung !== STANDARD.sortierung) {
    parameter.set('sortierung', abfrage.sortierung)
  }
  if (abfrage.seite !== STANDARD.seite) parameter.set('seite', String(abfrage.seite))

  return parameter
}

/** One or more parts of the selection, changed together. */
export type Aenderung = Partial<Prueflistenabfrage>

/** Everything that narrows or reorders the list, as opposed to paging it. */
const FILTERFELDER = ['status', 'anlass', 'jahr', 'suche', 'art', 'sortierung'] as const

/* Whether the reader has narrowed the queue themselves.
 *
 * The page number is deliberately not part of the answer, and that is the whole
 * reason this is a named, tested function rather than a check on the query
 * string. Asking "is anything in the address bar?" counts being on page 2 as
 * being filtered, which makes an empty page past the end say "nothing matches
 * your filters" to somebody who has set none, and offer them a reset button for
 * filters that do not exist.
 *
 * The order is counted, because a reader who changed it has made a choice about
 * the list that is worth offering to undo alongside the rest.
 */
export function istGefiltert(abfrage: Prueflistenabfrage): boolean {
  return FILTERFELDER.some((feld) => abfrage[feld] !== STANDARD[feld])
}

/* A changed selection, back on the first page whenever the list itself changed.
 *
 * Without the reset, narrowing the queue while on page 4 lands on a page that no
 * longer exists, and a filter that matched plenty looks like one that matched
 * nothing. Setting a filter to the value it already holds is not a change, so
 * reselecting the order you are already using does not throw away your place.
 */
export function mitAenderung(
  abfrage: Prueflistenabfrage,
  aenderung: Aenderung,
): Prueflistenabfrage {
  const neu = { ...abfrage, ...aenderung }
  const gefiltert = FILTERFELDER.some((feld) => neu[feld] !== abfrage[feld])

  return { ...neu, seite: begrenzeSeite(gefiltert ? STANDARD.seite : neu.seite) }
}

/* The selection, as GET /api/v1/pruefliste is asked for it.
 *
 * Not the same string as the address bar's. The order and the page are always
 * named, defaults included, because nobody reads this one and a request in the
 * network tab that spells out what it asked for answers for itself. The status
 * is expanded here: "offen" is two repeated parameters, "alle" is none at all.
 */
export function alsEndpunktParameter(abfrage: Prueflistenabfrage): URLSearchParams {
  const parameter = new URLSearchParams()

  if (abfrage.status === 'offen') {
    for (const zustand of OFFEN) parameter.append('status', zustand)
  } else if (abfrage.status !== 'alle') {
    parameter.append('status', abfrage.status)
  }

  if (abfrage.anlass !== null) parameter.set('anlass', abfrage.anlass)
  if (abfrage.jahr !== null) parameter.set('jahr', String(abfrage.jahr))

  const suche = abfrage.suche.trim()
  if (suche !== '') parameter.set('suche', suche)

  if (abfrage.art !== null) parameter.set('art', abfrage.art)

  parameter.set('sortierung', abfrage.sortierung)
  parameter.set('seite', String(abfrage.seite))

  return parameter
}
