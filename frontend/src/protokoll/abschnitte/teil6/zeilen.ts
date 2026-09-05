import { ARTNUMMERN, MAX_ARTEN, ZEILENFELDER, artPfad } from './tabelle'
import type { AntwortPfad, Antworten, Artnummer, Artzeile } from '../../entwurf/typen'

/* Which catch rows are on screen, and what happens when one is taken away.
 *
 * The legacy form shows all twenty-six rows and hides the eleven cells of each
 * until a species is chosen. We hide the whole row instead, because 312 empty
 * boxes is not a form anybody can fill in.
 *
 * How many rows are open describes the screen rather than the survey, so it is
 * not an answer and is not stored. It is worked out from the draft on load and
 * grows as the last row is filled.
 *
 * Rows stay ordered and gapless: removing row 2 of four moves 3 into 2 rather
 * than leaving a hole, so the numbering matches what a reader counts down the
 * page and the eventual FiaKa transfer never sends an empty art2 between two
 * filled ones.
 */

export type Artengruppe = NonNullable<Antworten['arten']>

/** Whether a row holds no answer at all, species included. */
export function zeileIstLeer(zeile: Artzeile | undefined): boolean {
  if (zeile === undefined) return true
  return ZEILENFELDER.every((feld) => (zeile[feld] ?? '').trim() === '')
}

/** The highest row number holding anything, or 0 for an untouched table. */
export function letzteGefuellteZeile(arten: Artengruppe | undefined): number {
  let letzte = 0
  for (const nr of ARTNUMMERN) {
    if (!zeileIstLeer(arten?.[`art${nr}`])) letzte = nr
  }
  return letzte
}

/* How many rows to open on a draft: the filled ones plus a blank to type into.
 *
 * Always at least one, so a fresh protocol has somewhere to start, and never
 * more than twenty-six, so a full table does not offer a twenty-seventh row the
 * form has no field for. A draft saved before feature 9a has no arten key at all
 * and lands on one blank row, which is the same answer as a fresh one. */
export function anfangsZeilen(arten: Artengruppe | undefined): number {
  return Math.min(Math.max(letzteGefuellteZeile(arten) + 1, 1), MAX_ARTEN)
}

/* The table with one row taken out and the rows below it moved up.
 *
 * A whole new group rather than an edit in place, so the shift is one value a
 * test can look at. What the form actually gets is entfernenSchreiben's
 * field-by-field version of the same answer.
 *
 * The freed tail is written as empty strings rather than left undefined, because
 * React Hook Form only updates an input it is given a value for: an absent last
 * row would keep showing the values that moved up out of it. */
export function zeileEntfernen(
  arten: Artengruppe | undefined,
  nr: Artnummer,
): Artengruppe {
  const behalten = ARTNUMMERN.filter((n) => n !== nr).map((n) => arten?.[`art${n}`])

  const neu: Artengruppe = {}
  ARTNUMMERN.forEach((ziel, index) => {
    neu[`art${ziel}`] = behalten[index] ?? leereZeile()
  })
  return neu
}

function leereZeile(): Artzeile {
  return Object.fromEntries(ZEILENFELDER.map((feld) => [feld, ''])) as Artzeile
}

/** One field to write, and what to write into it. */
export interface Schreibvorgang {
  pfad: AntwortPfad
  wert: string
}

/* The shift expressed as one write per field, which is how it has to be applied.
 *
 * Handing React Hook Form the whole group in a single setValue looks tidier and
 * is wrong: it updates the registered number inputs but leaves the
 * Controller-driven species pickers showing the value that moved up out of them,
 * until the page is reloaded. Found on 2026-09-04 by driving the real table.
 *
 * Rows above the removed one did not move, so they are left out. Removing the
 * last open row of three costs 24 writes rather than 312. */
export function entfernenSchreiben(
  arten: Artengruppe | undefined,
  nr: Artnummer,
): Schreibvorgang[] {
  const neu = zeileEntfernen(arten, nr)

  return ARTNUMMERN.filter((n) => n >= nr).flatMap((n) =>
    ZEILENFELDER.map((feld) => ({
      pfad: artPfad(n, feld),
      wert: neu[`art${n}`]?.[feld] ?? '',
    })),
  )
}
