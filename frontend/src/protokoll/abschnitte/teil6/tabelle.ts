import type { ParseKeys } from 'i18next'
import type {
  AntwortPfad,
  Artfeld,
  Artnummer,
  Klassenfeld,
} from '../../entwurf/typen'

/* The catch table, declared once and rendered by mapping.
 *
 * The same shape and the same reasoning as teil3/gruppen.ts, teil4/bloecke.ts
 * and teil5/bloecke.ts, which this file should be read alongside. A declared
 * array is the only thing tabelle.test.ts can check against felder.json, which
 * is what proves these paths match the legacy form; Antworten is a TypeScript
 * interface and is gone at build time.
 *
 * Part 6 declares far more than any earlier part, and for the opposite reason to
 * part 5. There the ten equipment fields differed from one another in type, unit
 * and control, so a shared definition bought nothing. Here 312 fields are the
 * same twelve questions asked twenty-six times, and writing them out would be
 * 312 lines nobody can review.
 */

export const MAX_ARTEN = 26

/* The row numbers, 1 to 26. Built rather than typed out, and asserted against
   MAX_ARTEN in the test, so the two cannot drift. The cast is the one place this
   file asserts something TypeScript cannot see: Array.from produces number, and
   only the length above makes every entry an Artnummer. */
export const ARTNUMMERN: readonly Artnummer[] = Array.from(
  { length: MAX_ARTEN },
  (_, index) => index + 1,
) as Artnummer[]

/* One of the ten size class columns.
 *
 * Two texts, not one, and both are needed. kopfKey is what fits in a column
 * heading, "≤ 5" or ">10 - 15". nameKey is the same class in words, "über 10 bis
 * 15 cm", which is what a cell's own accessible name is built from: a screen
 * reader user never sees the column heading a sighted user reads across to, so
 * the heading alone would leave 260 numeric cells indistinguishable.
 */
export interface Groessenklasse {
  feld: Klassenfeld
  kopfKey: ParseKeys
  nameKey: ParseKeys
}

/* Ascending, and the order is load-bearing.
 *
 * Taken from the widget rectangles on page 3 rather than from the printed
 * headings, which extract out of order: arten.art1.klasse_1 sits at x=210 and
 * klasse_10 at x=473, left to right. Reordering this would file every catch
 * under the wrong size and nothing on screen would look wrong.
 *
 * All ten are in centimetres, from the block heading "Nachgewiesene Arten und
 * Größenklassen (cm)". The unit is said once, above the table, rather than ten
 * times across it. */
export const KLASSEN: readonly Groessenklasse[] = [
  {
    feld: 'klasse_1',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_1.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_1.name',
  },
  {
    feld: 'klasse_2',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_2.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_2.name',
  },
  {
    feld: 'klasse_3',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_3.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_3.name',
  },
  {
    feld: 'klasse_4',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_4.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_4.name',
  },
  {
    feld: 'klasse_5',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_5.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_5.name',
  },
  {
    feld: 'klasse_6',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_6.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_6.name',
  },
  {
    feld: 'klasse_7',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_7.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_7.name',
  },
  {
    feld: 'klasse_8',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_8.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_8.name',
  },
  {
    feld: 'klasse_9',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_9.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_9.name',
  },
  {
    feld: 'klasse_10',
    kopfKey: 'protokoll.abschnitt6.klasse.klasse_10.kopf',
    nameKey: 'protokoll.abschnitt6.klasse.klasse_10.name',
  },
]

/** Everything one row stores, in the order the printed form prints it. */
export const ZEILENFELDER: readonly Artfeld[] = [
  'name',
  ...KLASSEN.map(({ feld }) => feld),
  '0plus',
]

/** One answer's legacy path, such as arten.art7.klasse_3. */
export function artPfad(nr: Artnummer, feld: Artfeld): AntwortPfad {
  return `arten.art${nr}.${feld}`
}

/** A row's ten size class paths, ascending. */
export function klassenPfade(nr: Artnummer): AntwortPfad[] {
  return KLASSEN.map(({ feld }) => artPfad(nr, feld))
}

/* Every path part 6 stores: 26 rows of 12. Recomputed on each call rather than
   frozen into a constant, because the only callers are the test and a memo. */
export function alleArtPfade(): AntwortPfad[] {
  return ARTNUMMERN.flatMap((nr) => ZEILENFELDER.map((feld) => artPfad(nr, feld)))
}

/* The grand total at the foot of the table, and the 26 row totals above it.
 *
 * Real names in felder.json with deliberately no key in Antworten, which is why
 * they are typed as plain strings rather than as AntwortPfad. The legacy form
 * marks all 27 calculated and read-only, so storing them would let a hand-edited
 * draft carry a total that disagrees with its own cells. They are derived on
 * screen instead, by teil6/Zeilensumme.tsx and teil6/Gesamtsumme.tsx.
 *
 * Exported only so tabelle.test.ts can prove the 312 stored and these 27 account
 * for the whole arten group with nothing left over. Without them the test could
 * not tell a field we chose not to store from one somebody forgot. */
export const GESAMTSUMME_FELD = 'arten.gesamtsumme'

export const ABGELEITETE_FELDER: readonly string[] = [
  ...ARTNUMMERN.map((nr) => `arten.art${nr}.summe`),
  GESAMTSUMME_FELD,
]
