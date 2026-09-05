import { alsZahl, istLeer } from './regel'

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
