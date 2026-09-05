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

/* Everything one row stores, in the order the printed form prints it, each with
 * the words that name it.
 *
 * The names are the same ones ArtZeile builds each cell's accessible name from,
 * so a message about a cell can say which cell it is in exactly the wording the
 * cell announces itself with. Kept as one list rather than restated where the
 * messages are rendered, because two lists of twelve would drift. */
export interface Zeilenspalte {
  feld: Artfeld
  nameKey: ParseKeys
}

export const ZEILENSPALTEN: readonly Zeilenspalte[] = [
  { feld: 'name', nameKey: 'protokoll.abschnitt6.spalte.art' },
  ...KLASSEN.map(({ feld, nameKey }) => ({ feld, nameKey })),
  { feld: '0plus', nameKey: 'protokoll.abschnitt6.spalte.nullPlusName' },
]

/** Everything one row stores, in the order the printed form prints it. */
export const ZEILENFELDER: readonly Artfeld[] = ZEILENSPALTEN.map(({ feld }) => feld)

/** One answer's legacy path, such as arten.art7.klasse_3. */
export function artPfad(nr: Artnummer, feld: Artfeld): AntwortPfad {
  return `arten.art${nr}.${feld}`
}

/** A row's ten size class paths, ascending. */
export function klassenPfade(nr: Artnummer): AntwortPfad[] {
  return KLASSEN.map(({ feld }) => artPfad(nr, feld))
}

/* The eleven fields in a row that hold a count: the ten size classes, then 0+.
 *
 * Not the same list as KLASSEN, and the difference is load-bearing. A row total
 * is the ten classes alone, because the printed form heads the 0+ column "davon"
 * and those individuals are already counted beside them. What all eleven have in
 * common is only that each must be a whole number of animals. */
export const ZAEHLFELDER: readonly Artfeld[] = [
  ...KLASSEN.map(({ feld }) => feld),
  '0plus',
]

/** One row's eleven count paths. */
export function zaehlfelder(nr: Artnummer): AntwortPfad[] {
  return ZAEHLFELDER.map((feld) => artPfad(nr, feld))
}

/* Whether anybody has left a count cell in the table yet.
 *
 * React Hook Form's touched tree mirrors the values, so this is a walk two levels
 * down rather than a lookup. The species cells are deliberately not counted: the
 * table's own message is a verdict on the counts, and a species picker is blurred
 * the moment one is chosen, which would open the gate before a single number had
 * been typed.
 *
 * Takes unknown because React Hook Form's touched tree is a deep partial of the
 * answers document and this only ever asks whether a leaf is set. */
export function zaehlzelleBeruehrt(zeilen: unknown): boolean {
  if (!zeilen || typeof zeilen !== 'object') return false

  return Object.values(zeilen as Record<string, unknown>).some((zeile) => {
    if (!zeile || typeof zeile !== 'object') return false
    const felder = zeile as Record<string, unknown>
    return ZAEHLFELDER.some((feld) => Boolean(felder[feld]))
  })
}

/** Every row's species cell, which is what the cross-row rules are judged on. */
export function namensPfade(): AntwortPfad[] {
  return ARTNUMMERN.map((nr) => artPfad(nr, 'name'))
}

/* Which cells are worth rechecking when one cell changes.
 *
 * Three of part 6's rules span more than one cell, and React Hook Form only
 * rechecks the field being edited, so without this they go stale: correcting the
 * size class that a 0+ count was too large for would leave the 0+ message
 * standing, and clearing a duplicate species would leave the second row red.
 *
 * A pure function over a path, so it is testable without a form. Handed to
 * useNachpruefung by ArtenTabelle.
 */
export function nachzupruefen(geaendert: AntwortPfad): readonly AntwortPfad[] {
  const [, zeile, feld] = geaendert.split('.')

  /* A species changing can settle or raise a duplicate anywhere in the table,
     and OFAN's rule reads every row, so all twenty-six are rechecked. */
  if (feld === 'name') return namensPfade()

  const name = `arten.${zeile}.name` as AntwortPfad

  /* A count changing can settle the row's 0+ message and the no-detection
     contradiction on its species. 0+ is left out when it changed itself, so its
     own message keeps the blur cadence every field on this form follows rather
     than objecting to a number still being typed. */
  return feld === '0plus' ? [name] : [`arten.${zeile}.0plus` as AntwortPfad, name]
}

/* Where the table's own message lives.
 *
 * The same device teil3/gruppen.ts, teil4/bloecke.ts and teil5/bloecke.ts all
 * use, and for the same reason: no path in the answers document names the table,
 * and a survey that recorded nothing without saying so is wrong in no single
 * cell. The prefix keeps it clear of the answers, where arten is a real group. */
export const ARTEN_TABELLE = 'tabelle.arten' as const

export type Tabellenpfad = typeof ARTEN_TABELLE

/* The four species codes that record a survey finding nothing.
 *
 * Read straight out of the printed form's own species list, where they sit
 * between Kaulbarsch and Kesslergrundel under the labels "kein Nachweis", "kein
 * Nachweis, Fische", "kein Nachweis, Krebse" and "kein Nachweis, Muscheln". They
 * are ordinary entries in the picker; what makes them different is only what
 * they mean, which is what feature 9b's rules are about.
 *
 * Pinned against optionslisten.json in tabelle.test.ts. A code renamed upstream
 * would otherwise disable the rule silently rather than fail. */
export const KEIN_NACHWEIS: readonly string[] = ['OFAN', 'OFAF', 'KNKR', 'KNMU']

/* The unqualified one. The other three each name what was not found, so "kein
 * Nachweis, Krebse" beside three Hechte is coherent, while this one says nothing
 * at all was found and so excludes every other species in the table.
 *
 * Telling the qualified three apart from a species they contradict would need to
 * know which of the 123 entries is a fish, a crayfish or a mussel, and the seed
 * list carries only a code and a German label. See question 10 in
 * docs/ffs-questions.md. */
export const OHNE_QUALIFIKATION = 'OFAN'

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
