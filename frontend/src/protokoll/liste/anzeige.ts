/* What a list row prints, worked out without a browser.
 *
 * Plain functions taking and returning values, the arrangement
 * coding-standards.md asks for wherever a wrong answer is possible. Every one of
 * these has a wrong answer available to it: a date printed a day out, a status
 * badge with no label, a count that says "6 Protokolle" over five rows.
 *
 * Nothing here translates. A function that reached for i18next could not be
 * tested without initialising it, so the two that need words hand back a key and
 * the component says it. fehlertext in api/fehler.ts is arranged the same way.
 */

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { optionen } from '../optionen'
import { titelAusTeilen } from '../entwurf/titel'
import type { Status, Uebersicht } from '../entwurf/typen'

// Needed for the strict parse below: without it dayjs falls back to the Date
// constructor and reads almost anything as a date.
dayjs.extend(customParseFormat)

/** How FeldDatum writes a day into the answers document. */
const GESPEICHERT = 'YYYY-MM-DD'

/** How the form prints one, and what the mockup's rows show. */
const ANGEZEIGT = 'DD.MM.YYYY'

const UHRZEIT = 'HH:mm'

/* The survey date, as stored, for printing.
 *
 * null for anything unreadable rather than a thrown error or "Invalid Date". A
 * draft is incomplete by definition, and a protocol is never migrated to a later
 * form version (ADR 0004), so a value that no longer parses is a thing this
 * screen has to survive rather than a bug to surface at the surveyor.
 */
export function datumAnzeige(datum: string | null): string | null {
  if (datum === null) return null

  const tag = dayjs(datum, GESPEICHERT, true)
  return tag.isValid() ? tag.format(ANGEZEIGT) : null
}

/* When a protocol was last worked on, in the three shapes the mockup uses.
 *
 * A key and its value rather than a sentence, because "heute" and "gestern" are
 * words and this file has no i18next in it.
 */
export type Bearbeitet =
  | { art: 'heute'; zeit: string }
  | { art: 'gestern'; zeit: string }
  | { art: 'datum'; datum: string }

/* The clock is an argument, not a global.
 *
 * The whole answer turns on which calendar day "now" is, so a function reading
 * the real clock could only be tested by waiting for tomorrow. Comparison is by
 * local day, not by elapsed hours: something saved at 23:59 is "gestern" at
 * 00:01, which is how a person reads it, and 20 hours ago is not.
 */
export function bearbeitetAnzeige(zeitpunkt: string, jetzt: Date): Bearbeitet | null {
  const bearbeitet = dayjs(zeitpunkt)
  if (!bearbeitet.isValid()) return null

  const heute = dayjs(jetzt)
  if (bearbeitet.isSame(heute, 'day')) return { art: 'heute', zeit: bearbeitet.format(UHRZEIT) }
  if (bearbeitet.isSame(heute.subtract(1, 'day'), 'day')) {
    return { art: 'gestern', zeit: bearbeitet.format(UHRZEIT) }
  }

  return { art: 'datum', datum: bearbeitet.format(ANGEZEIGT) }
}

function gefuellt(wert: string | null): string | null {
  const sauber = wert?.trim()
  return sauber ? sauber : null
}

/* What to call one protocol in a sentence about it.
 *
 * One function rather than a name assembled at each call site, because two
 * sentences about the same row that name it differently read as two different
 * protocols: the question "«Schussen, Weißenau» löschen?" followed by "«Schussen»
 * ist noch da" is the failure that made this its own function.
 *
 * The fullest name available, which is titel.ts's, the same one the protocol's
 * own page heading uses. The table's first cell is the deliberate exception: it
 * prints the water alone because the Ortsangabe is on the line directly beneath
 * it, and repeating it would be noise rather than identification.
 *
 * null when nothing has been typed yet. The caller supplies the placeholder,
 * since it is a word and this file has no i18next in it.
 */
export function protokollName(zeile: Uebersicht): string | null {
  return titelAusTeilen(zeile.gewaessername ?? undefined, zeile.ortsangabe ?? undefined)
}

/* What the table's first cell prints, which is the water on its own.
 *
 * The one place a protocol is not called by protokollName above, and the reason
 * is the cell's second line: unterzeile prints the Ortsangabe directly beneath
 * this, so the fuller name would say the same place twice in one cell. Prose
 * about a row has no second line and uses the full name.
 *
 * Here rather than inline in the row, so the rule is one named, tested thing
 * instead of a fragment of JSX that the next screen would rewrite slightly
 * differently.
 */
export function zeilenTitel(zeile: Uebersicht): string | null {
  return gefuellt(zeile.gewaessername)
}

/* Metres. The same symbol in both locales and on the printed form, so it is not
   a translated string. */
const EINHEIT = 'm'

/* The row's second line: where on the water, and how much of it.
 *
 * The mockup writes "Weißenau, oberhalb der Brücke · 120 m". Either half can be
 * missing on a draft, and a row reading "· 120 m" would look broken, so the
 * separator only appears between two things that are both there.
 */
export function unterzeile(ortsangabe: string | null, laenge: string | null): string | null {
  const ort = gefuellt(ortsangabe)
  const meter = gefuellt(laenge)

  const teile = [ort, meter === null ? null : `${meter} ${EINHEIT}`].filter(
    (teil): teil is string => teil !== null,
  )

  return teile.length > 0 ? teile.join(' · ') : null
}

/* The occasion's label, from the list the form's own dropdown reads.
 *
 * Falling back to the stored code rather than to nothing. ADR 0004 never
 * migrates a protocol to a later form version, so a draft can carry a code this
 * version no longer offers; an unfamiliar code still tells its owner more than
 * an empty cell, and it is what FiaKa will receive.
 */
export function anlassLabel(anlass: string | null): string | null {
  const code = gefuellt(anlass)
  if (code === null) return null

  return optionen('anlass').find((option) => option.wert === code)?.label ?? code
}

/* Which of the token colours a badge takes. Named for the token rather than for
   MUI's palette, because theme.css is what these resolve against. */
export type Statusfarbe = 'neutral' | 'info' | 'warn' | 'danger' | 'ok'

/* A key into de.json, not a word. Spelled as a template literal type so that a
   status without a string in the locale file is a build error rather than a
   badge printing its own key at a surveyor. */
export type Statusschluessel = `protokolle.list.status.${Status}`

export interface Statusanzeige {
  schluessel: Statusschluessel
  farbe: Statusfarbe
}

/* Colour by what the state asks of the person looking at it: grey while it is
 * still theirs to write, blue while somebody else has it, amber and red when it
 * has come back to them, green when it is done. Colour never carries the meaning
 * on its own; the badge always prints the word too.
 *
 * All seven are here although only DRAFT can occur today, so feature 11 adds a
 * workflow rather than a vocabulary. LOCKED's wording is provisional until that
 * feature settles the language.
 */
const FARBEN: Record<Status, Statusfarbe> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  IN_REVIEW: 'info',
  NEEDS_CHANGES: 'warn',
  REJECTED: 'danger',
  ACCEPTED: 'ok',
  LOCKED: 'ok',
}

export function statusAnzeige(status: Status): Statusanzeige {
  return { schluessel: `protokolle.list.status.${status}`, farbe: FARBEN[status] }
}

export interface Zaehlungen {
  gesamt: number
  entwuerfe: number
}

/* The count line: "6 Protokolle, davon 2 Entwürfe".
 *
 * Drafts are worth their own number because they are the ones with something
 * still to do. The endpoint is not paginated, so this counts what arrived rather
 * than asking the server for a total.
 */
export function zaehlungen(zeilen: readonly Uebersicht[]): Zaehlungen {
  return {
    gesamt: zeilen.length,
    entwuerfe: zeilen.filter((zeile) => zeile.status === 'DRAFT').length,
  }
}
