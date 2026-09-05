import { alsZahl, istLeer, wertAus, type Regel, type Regelverstoss } from './regel'
import {
  ARTEN_TABELLE,
  ARTNUMMERN,
  KEIN_NACHWEIS,
  OHNE_QUALIFIKATION,
  artPfad,
  klassenPfade,
  zaehlfelder,
} from '../abschnitte/teil6/tabelle'
import type { Antworten, AntwortPfad, Artnummer } from '../entwurf/typen'

/* What the catch table adds up to.
 *
 * The legacy form works both totals out for itself, with
 * AFSimple_Calculate("SUM", ...) over the ten size classes for a row and over
 * the twenty-six row sums for the table, and marks the results read-only. So
 * they are derived here too and never stored: a total in the draft would be a
 * second, disagreeing answer to a question the cells already answer.
 *
 * Plain functions over the answers document, holding no React and no German, so
 * the number on screen and the verdict feature 9b reaches are the same
 * arithmetic. The same split teil3/Gruppensumme.tsx has with regeln/prozent.ts,
 * and for the same reason: a running total computed one way in the view and
 * another way in the rule is how a form comes to disagree with itself.
 *
 * ## Why 0+ is not in either total
 *
 * The printed form heads that column "davon", which is "of which". Young-of-year
 * individuals are already counted in the size classes beside them, so adding the
 * column would count them twice. The legacy form's own gesamtsumme sums only the
 * row sums and never the 0+ fields, which is the same decision made the same
 * way. Feature 9b adds the rule that follows from it: a row's 0+ count can never
 * exceed the row's total.
 *
 * ## Why an unreadable cell makes the total undefined
 *
 * A blank cell is nothing and counts as zero, which is what an unfilled table
 * means. A cell holding a word is different: the total is then unknowable, and
 * saying so is the only honest answer. Reporting the sum of the readable cells
 * would put a confident wrong number under a column, and NaN would put a fault
 * on screen that the surveyor did not cause and cannot read.
 *
 * It can only arrive by paste or by hand-editing a saved draft, since the cells
 * are number inputs. Rare is not never, and this is the section where a wrong
 * total is a wrong scientific record.
 */

/* Counts added up, given the values themselves.
 *
 * Takes the values rather than the answers document because that is what the
 * callers have: both totals come from a useWatch scoped to the cells they cover,
 * and rebuilding a document from them just to take it apart again would be a
 * second copy of this loop. The same split regeln/prozent.ts makes with
 * bewerteAnteile.
 *
 * ## Whole fish only
 *
 * A count is a number of individuals, so 2.5 is not a smaller answer than 3, it
 * is not an answer. Rejecting it also settles what "1.200" means, which is the
 * one place a shared number parser could quietly lose 999 fish: alsZahl reads
 * the dot as a decimal point, so "1.200" comes back as 1.2, and treating that as
 * a total would be exactly the confident wrong number this file refuses to
 * print. Neither can be typed into the cells, which are number inputs, but both
 * survive a hand-edited draft, and this is the section where a wrong total is a
 * wrong scientific record.
 *
 * Part 5's quantities go through the same alsZahl and are deliberately left
 * alone: a fished length of 1.2 m is a real measurement. Only counts are whole.
 */
export function summeAusWerten(
  werte: readonly (string | undefined)[],
): number | undefined {
  let summe = 0

  for (const wert of werte) {
    if (istLeer(wert)) continue

    const zahl = alsZahl(wert)
    if (zahl === undefined || !Number.isInteger(zahl)) return undefined
    summe += zahl
  }

  return summe
}

/* Whether a cell holds something that is not a count of animals.
 *
 * Blank is not, because untouched is never wrong in a draft. Everything else
 * has to be a whole number of zero or more: 2.5 is not a smaller answer than 3,
 * minus four fish were not caught, and "1.200" reads through alsZahl as 1.2,
 * which would quietly lose 999 individuals.
 *
 * None of these can be typed. ZahlZelle sets min="0" and step="1", so they only
 * arrive by paste or by hand-editing a saved draft. The legacy form has no
 * keystroke handler, no format check and no range check anywhere in part 6, so a
 * negative count reaches FiaKa today. Rejecting it is ours rather than a port,
 * on the same footing as part 5's sign check, and it needs nothing from FFS.
 */
function istUnmoeglicheAnzahl(wert: string | undefined): boolean {
  if (istLeer(wert)) return false

  const zahl = alsZahl(wert)
  return zahl === undefined || !Number.isInteger(zahl) || zahl < 0
}

/** The cells in one row holding something that is not a count. */
function unmoeglicheZellen(antworten: Antworten, nr: Artnummer): AntwortPfad[] {
  return zaehlfelder(nr).filter((pfad) => istUnmoeglicheAnzahl(wertAus(antworten, pfad)))
}

function unmoeglicheAnzahlen(antworten: Antworten): Regelverstoss[] {
  return ARTNUMMERN.flatMap((nr) =>
    unmoeglicheZellen(antworten, nr).map((pfad) => ({
      pfad,
      schluessel: 'protokoll.regeln.anzahlKeineGanzeZahl' as const,
    })),
  )
}

/* A row's 0+ count cannot be larger than the row itself.
 *
 * The printed form heads that column "davon", which is "of which": the
 * young-of-year individuals are already counted in the ten size classes beside
 * them. So a row claiming seven 0+ out of a total of two is claiming five fish
 * that are in no size class at all. The legacy form calculates the row total and
 * never compares the two.
 *
 * Quiet about a row it cannot judge. If any of the eleven cells fails the rule
 * above, the total is not a number anybody should be reasoning from, and the
 * cell that broke it has already said so; adding a second message about a
 * consequence would only bury the cause. The same suppression regeln/prozent.ts
 * makes when a share is unreadable.
 *
 * Ten blank classes with 3 in 0+ does report, and that is deliberate: a row
 * total of nothing cannot contain three fish. It waits for the 0+ cell to be
 * left, which is the onTouched cadence every field message on this form follows.
 */
function nullPlusUeberZeile(antworten: Antworten): Regelverstoss[] {
  return ARTNUMMERN.filter((nr) => zeileUeberzaehlt(antworten, nr)).map((nr) => ({
    pfad: artPfad(nr, '0plus'),
    schluessel: 'protokoll.regeln.nullPlusUeberSumme' as const,
  }))
}

function zeileUeberzaehlt(antworten: Antworten, nr: Artnummer): boolean {
  const nullPlus = wertAus(antworten, artPfad(nr, '0plus'))
  if (istLeer(nullPlus)) return false

  if (unmoeglicheZellen(antworten, nr).length > 0) return false

  const summe = summeAusWerten(klassenPfade(nr).map((pfad) => wertAus(antworten, pfad)))
  if (summe === undefined) return false

  // Non-null: the cell is not blank and passed istUnmoeglicheAnzahl above, so it
  // is a whole number.
  return (alsZahl(nullPlus) as number) > summe
}

/* The export code a row names, or "" for a row that names no species.
 *
 * Returned exactly as stored. The codes come from the picker rather than from
 * typing, so casing and whitespace carry no information, and normalising them
 * here would hide a seed list that had drifted rather than fix one. */
function artcode(antworten: Antworten, nr: Artnummer): string {
  return wertAus(antworten, artPfad(nr, 'name'))
}

/** Every species actually named in the table, in row order, blanks left out. */
function benannteArten(antworten: Antworten): string[] {
  return ARTNUMMERN.map((nr) => artcode(antworten, nr)).filter((code) => !istLeer(code))
}

/* One species, one row.
 *
 * Two rows both naming HECH are two answers to one question, and the eventual
 * FiaKa transfer would carry the species twice with different counts. The legacy
 * form permits it: it has no cross-row check of any kind.
 *
 * Reported on the second row and any after it, never on the first. The row that
 * was named first is not the one that went wrong, and reddening it would ask the
 * surveyor to correct the answer they got right.
 *
 * The codes are compared exactly. They come from the picker rather than from
 * typing, so casing and whitespace carry no information and normalising them
 * would only hide a seed list that had drifted.
 */
function doppelteArten(antworten: Antworten): Regelverstoss[] {
  const gesehen = new Set<string>()

  return ARTNUMMERN.filter((nr) => {
    const code = artcode(antworten, nr)
    if (istLeer(code)) return false
    if (gesehen.has(code)) return true

    gesehen.add(code)
    return false
  }).map((nr) => ({
    pfad: artPfad(nr, 'name'),
    schluessel: 'protokoll.regeln.artDoppelt' as const,
  }))
}

/* A row that reports no detection cannot also count animals.
 *
 * "kein Nachweis, Fische" beside 7 in the 10-15 cm column says both that no fish
 * were found and that seven were. Reported on the species cell rather than on
 * the counts: the counts are the record of what was seen, and the code is the
 * answer that contradicts them.
 *
 * Only a count above zero is a catch, so a word or a negative number never
 * reaches this rule and is left to the one that judges counts. A fraction does
 * reach it, and the row then carries two messages in two cells, which is right:
 * 2,5 is both an impossible count and a catch this row says it did not make.
 */
function keinNachweisMitFang(antworten: Antworten): Regelverstoss[] {
  return ARTNUMMERN.filter((nr) => {
    if (!KEIN_NACHWEIS.includes(artcode(antworten, nr))) return false

    return zaehlfelder(nr).some((pfad) => {
      const zahl = alsZahl(wertAus(antworten, pfad))
      return zahl !== undefined && zahl > 0
    })
  }).map((nr) => ({
    pfad: artPfad(nr, 'name'),
    schluessel: 'protokoll.regeln.keinNachweisMitFang' as const,
  }))
}

/* "kein Nachweis" excludes everything else in the table.
 *
 * OFAN is the unqualified code: nothing at all was found. So any other species
 * named anywhere in the table contradicts it outright, whichever row it sits in.
 *
 * The other three are each qualified, naming what was not found, so "kein
 * Nachweis, Krebse" standing beside three Hechte is perfectly coherent while
 * "kein Nachweis, Fische" is not. Separating those two cases needs to know which
 * of the 123 entries is a fish, a crayfish or a mussel, and the seed list carries
 * only a code and a German label. Inferring the group from the label's wording is
 * the kind of guess this project refuses, so it is question 10 in
 * docs/ffs-questions.md instead.
 */
function keinNachweisNebenArt(antworten: Antworten): Regelverstoss[] {
  const andere = benannteArten(antworten).some((code) => code !== OHNE_QUALIFIKATION)
  if (!andere) return []

  return ARTNUMMERN.filter((nr) => artcode(antworten, nr) === OHNE_QUALIFIKATION).map(
    (nr) => ({
      pfad: artPfad(nr, 'name'),
      schluessel: 'protokoll.regeln.keinNachweisNebenArt' as const,
    }),
  )
}

/* A survey that caught nothing has to say so with one of the four codes.
 *
 * This is the rule project-overview.md states as "an empty arten list requires
 * one of the four no detection codes", and it is the one that needs the most
 * care, because in a draft "nothing caught" and "not filled in yet" look almost
 * the same. Three conditions separate them, and all three are needed:
 *
 *   a real species is named    otherwise there is nothing to correct, and an
 *                              empty table is a draft rather than a claim
 *   no code is named           a table that already says "kein Nachweis" has
 *                              said it
 *   every count is 0, and at   this is the difference Gesamtsumme.tsx draws
 *   least one was typed        between a blank cell and one holding a typed
 *                              zero: both are 0 arithmetically and they mean
 *                              opposite things
 *
 * Silent about a table holding anything unreadable or negative. That cell has
 * its own message, and a table whose totals cannot be trusted is not evidence
 * that nothing was caught.
 *
 * The message goes under the table, because no single cell is the wrong one:
 * the fix is to pick a "kein Nachweis" entry in place of the species named.
 *
 * Exported so teil6/TabellenMeldung.tsx can show the same verdict schema.ts
 * reaches. It cannot read the error the resolver raised: React Hook Form only
 * refreshes the error for the field it is validating, and tabelle.arten is not a
 * field, so a message hanging there would go stale the moment anything was
 * typed. teil3/Gruppensumme.tsx has the same arrangement with bewerteAnteile and
 * that file's history records why.
 */
export function fangOhneNachweisCode(antworten: Antworten): Regelverstoss[] {
  const benannt = benannteArten(antworten)

  if (!benannt.some((code) => !KEIN_NACHWEIS.includes(code))) return []
  if (benannt.some((code) => KEIN_NACHWEIS.includes(code))) return []

  const gezaehlt = ARTNUMMERN.flatMap((nr) => zaehlfelder(nr))
    .map((pfad) => wertAus(antworten, pfad))
    .filter((wert) => !istLeer(wert))

  if (gezaehlt.length === 0) return []
  if (gezaehlt.some((wert) => alsZahl(wert) !== 0)) return []

  return [
    { pfad: ARTEN_TABELLE, schluessel: 'protokoll.regeln.fangOhneNachweisCode' as const },
  ]
}

/* One message per cell, the first raised winning.
 *
 * A cell can break more than one rule at once: an OFAN row named twice beside a
 * real species is both a duplicate and a contradiction. Only one message can be
 * shown anyway, since a field holds a single error, so which one that is gets
 * decided here rather than left to whichever order the resolver happens to keep.
 *
 * The order below is what does the deciding, and it runs from the most specific
 * complaint to the most general: what a cell holds, then what it contradicts,
 * then that it has been said before.
 */
function ersteJePfad(verstoesse: readonly Regelverstoss[]): Regelverstoss[] {
  const gesehen = new Set<string>()

  return verstoesse.filter(({ pfad }) => {
    if (gesehen.has(pfad)) return false
    gesehen.add(pfad)
    return true
  })
}

export const pruefeArten: Regel = (antworten) =>
  ersteJePfad([
    ...unmoeglicheAnzahlen(antworten),
    ...nullPlusUeberZeile(antworten),
    ...keinNachweisMitFang(antworten),
    ...keinNachweisNebenArt(antworten),
    ...doppelteArten(antworten),
    ...fangOhneNachweisCode(antworten),
  ])
