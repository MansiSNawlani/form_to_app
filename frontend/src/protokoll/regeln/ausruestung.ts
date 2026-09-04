import { istLeer, wertAus, type Regel, type Regelverstoss } from './regel'
import {
  ANODEN_FELDER,
  ANODEN_PAAR,
  BREITE_FELDER,
  BREITE_PAAR,
  LAENGE_FELDER,
  LAENGE_PAAR,
  ZAHLENFELDER,
  type Feldpaar,
  type Paarpfad,
} from '../abschnitte/teil5/bloecke'
import type { Antworten } from '../entwurf/typen'

/* Part 5's rules: three pair checks ported from the legacy form, and one sign
 * check that is ours.
 *
 * ## The three pair checks
 *
 * All the same shape: two numbers, at least one of which has to say something.
 * The legacy form writes them as sums:
 *
 *   (ringanoden + streifenanoden) < 1
 *   (ges_gew_laenge + ufer_laenge) == 0
 *   (ges_gew_breite + ufer_breite) == 0
 *
 * Copied literally those fire on a brand new draft, where both boxes are empty,
 * and this form does not do that. ProtokollFormular.tsx puts it plainly: the
 * asterisks mark what is needed to submit, which is feature 11's gate, and the
 * rules only speak up about an answer that is wrong. A protocol is filled in
 * over several sittings, so an unanswered question is the normal state and is
 * not an error.
 *
 * So each check is split in two and neither half is dropped:
 *
 *   both boxes blank    nobody has answered yet. Silent here; feature 11
 *                       refuses the submission.
 *   both boxes zero     an answer, and a wrong one. Zero ring anodes and zero
 *                       strip anodes is a claim that the survey was carried out
 *                       with no anode, which cannot be true of an electrofishing
 *                       survey. Reported immediately.
 *   one blank, one set  fine. The legacy form is satisfied by either.
 *
 * Nothing is cleared and nothing is blocked, which regeln/prozent.ts settled for
 * the percentage runs and regeln/einfluesse.ts for the Einflüsse. The message
 * goes under the pair rather than on a box, because neither box is the wrong one
 * and only the surveyor knows which number they meant to change.
 *
 * ## The sign check
 *
 * None of part 5's nine quantities can be negative. The legacy form permits all
 * of them: it has no keystroke handler, no format check and no range check
 * anywhere in part 5, so a fished length of -50 reaches FiaKa today.
 *
 * Added on 2026-09-04 by decision, after the section was built. It is a
 * deliberate narrowing rather than a port, and it is the one narrowing here that
 * needs nothing from FFS: no survey reports a negative count of anodes. It is
 * not in docs/ffs-defect-list.md, because permitting a nonsense number is a gap
 * in what the form asks for rather than proof any record was entered that way.
 *
 * This one reports against the field itself, since there is exactly one box the
 * wrong number is in.
 */

/* The two lengths are checked against each other and the two widths against each
   other, never a row against itself. So a length given for the whole width of
   the water and a width given for the banks passes, leaving two half-filled rows.

   That is the legacy form's own pairing and it is kept deliberately, on the same
   grounds typen.ts gives for the Besatzmaßnahmen rows: the legacy form checks no
   row for completeness and neither do we. Whether a fished area needs both
   numbers is a question about how FFS reads these records, and it is on the list
   to ask them. It is not in ffs-defect-list.md, because permitting a thin answer
   is a gap in what the form asks for rather than something that corrupted a
   record. */

export interface Paar {
  pfad: Paarpfad
  schluessel: Regelverstoss['schluessel']
  /* Read from teil5/bloecke.ts rather than restated here, so the fields the rule
     judges and the fields the message watches cannot drift apart. bloecke.test.ts
     pins those against felder.json, which makes this side pinned too. */
  felder: Feldpaar
}

export const PAARE: readonly Paar[] = [
  {
    pfad: ANODEN_PAAR,
    schluessel: 'protokoll.regeln.anodenKeine',
    felder: ANODEN_FELDER,
  },
  {
    pfad: LAENGE_PAAR,
    schluessel: 'protokoll.regeln.befischteLaengeNull',
    felder: LAENGE_FELDER,
  },
  {
    pfad: BREITE_PAAR,
    schluessel: 'protokoll.regeln.befischteBreiteNull',
    felder: BREITE_FELDER,
  },
]

/** The pair a block's message belongs to, looked up by its path. */
export function findePaar(pfad: Paarpfad): Paar {
  // Non-null: Paarpfad is the union of exactly these three, so every value has
  // an entry and a missing one would be a build error rather than a lookup miss.
  return PAARE.find((paar) => paar.pfad === pfad) as Paar
}


/* An answer read as a number, however it was written. A count is typed as "0"
   and a length can be "0", "0,0" or "0.0", since the form is German and the
   input is not.

   undefined for blank, and for anything that is not a number at all. Neither is
   this file's business: a blank is an unanswered question, and a pasted word is
   rejected by the number input, so it can only arrive by hand-editing a saved
   draft and is caught by Pydantic at the boundary once feature 3 lands. */
function alsZahl(wert: string | undefined): number | undefined {
  const roh = (wert ?? '').trim().replace(',', '.')
  if (roh === '') return undefined
  const zahl = Number(roh)
  return Number.isFinite(zahl) ? zahl : undefined
}

/** Whether a pair of answers is a claim of nothing rather than an unfilled pair. */
export function istLeeresPaar(werte: readonly (string | undefined)[]): boolean {
  // At least one answered, and none of the answered ones above zero.
  if (werte.every(istLeer)) return false
  return werte.every((wert) => istLeer(wert) || alsZahl(wert) === 0)
}

/* A quantity that cannot be negative, and is.
 *
 * Unlike the pair checks, this one belongs to a single field and reports against
 * it, so the message sits on the box holding the wrong number.
 *
 * Only the sign is judged. A ceiling would need FFS to say what a plausible
 * voltage or ring anode diameter is, and guessing one is exactly what the
 * invented spinner ceiling on the anode counts was pulled for. */
function negativeZahlen(antworten: Antworten): Regelverstoss[] {
  return ZAHLENFELDER.filter((pfad) => {
    const zahl = alsZahl(wertAus(antworten, pfad))
    return zahl !== undefined && zahl < 0
  }).map((pfad) => ({ pfad, schluessel: 'protokoll.regeln.zahlNegativ' }))
}

function leerePaare(antworten: Antworten): Regelverstoss[] {
  return PAARE.filter(({ felder }) =>
    istLeeresPaar(felder.map((pfad) => wertAus(antworten, pfad))),
  ).map(({ pfad, schluessel }) => ({ pfad, schluessel }))
}

export const pruefeAusruestung: Regel = (antworten) => [
  ...negativeZahlen(antworten),
  ...leerePaare(antworten),
]
