import { istLeer, type Regel, type Regelverstoss } from './regel'
import { PROZENTGRUPPEN, type Prozentgruppe } from '../abschnitte/teil3/gruppen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The six Prozentgruppen of part 3, each of which has to come to exactly 100.
 *
 * Defect 1 in docs/ffs-defect-list.md is why there is no per-group branch
 * anywhere below. The legacy form keeps a check_ok_ indicator per group and
 * reads five of the six at submit, leaving Substratverteilung out, so a
 * substrate distribution totalling 43 is sent and accepted. One code path for
 * all six is the fix, and prozent.test.ts holds it to that.
 *
 * Unlike the legacy form, a share that would push a group past 100 is accepted
 * and the group is marked over. Refusing the keystroke, as the PDF does, makes
 * an ordinary correction impossible: at 100 already, the first digit of a
 * replacement cannot be typed until some other share has been cleared.
 *
 * PROZENTGRUPPEN is imported from abschnitte/, which is the one place a rule
 * reaches into a view folder. It is data rather than view: which fields make up
 * a group is a fact about the legacy form, and gruppen.test.ts pins it to
 * felder.json. Keeping a second copy of the six groups here so the import
 * pointed the other way would be two lists to hold in step, which is the
 * failure mode defect 1 already is. */

export interface Gruppenbewertung {
  /** What the run currently adds up to. A blank share counts as 0. */
  summe: number
  verstoesse: readonly Regelverstoss[]
}

/* Whole numbers only, and at most three digits. The legacy form reads these
   with parseInt, and 6a set min, max and step on the input, so anything else
   can only arrive by paste or by hand-editing a saved draft. */
const GANZER_PROZENTWERT = /^\d{1,3}$/

/* The groups address their fields by path, so the value has to be looked up
   from one. A walk rather than two fixed indexes, because AntwortPfad is any
   depth the document has, and part 1 already nests three deep at
   probestrecke.gewaesser.vorfluter1. */
function wertAus(antworten: Antworten, pfad: AntwortPfad): string {
  const wert = pfad
    .split('.')
    .reduce<unknown>(
      (aktuell, teil) => (aktuell as Record<string, unknown> | undefined)?.[teil],
      antworten,
    )
  return typeof wert === 'string' ? wert : ''
}

/* The shares of one run, in the run's own order, judged on their own.
 *
 * Split from bewerteGruppe so the running total on screen and the document's
 * validity are the same arithmetic. Gruppensumme has the values already, out of a
 * useWatch scoped to its own run, and rebuilding an answers document from them
 * just to take it apart again would be the kind of second implementation that
 * drifts. */
export function bewerteAnteile(
  gruppe: Prozentgruppe,
  werte: readonly (string | undefined)[],
): Gruppenbewertung {
  const verstoesse: Regelverstoss[] = []
  let summe = 0
  let angefasst = false

  for (const [index, { pfad }] of gruppe.felder.entries()) {
    const eingabe = (werte[index] ?? '').trim()
    // Blank is untouched, and it counts as 0 towards the total. A bank that is
    // entirely one thing is answered with one share of 100 and seven blanks.
    if (istLeer(eingabe)) continue
    angefasst = true

    if (!GANZER_PROZENTWERT.test(eingabe) || Number(eingabe) > 100) {
      verstoesse.push({ pfad, schluessel: 'protokoll.regeln.prozentKeineGanzeZahl' })
      continue
    }

    summe += Number(eingabe)
  }

  // An untouched run is not a wrong run. Whether a run is required at all is
  // feature 11's gate, not this rule's.
  if (!angefasst) return { summe, verstoesse }

  // A run holding something that is not a number has no total worth complaining
  // about, and two messages for one mistake is noise.
  if (verstoesse.length > 0) return { summe, verstoesse }

  if (summe !== 100) {
    verstoesse.push({
      pfad: gruppe.id,
      schluessel: 'protokoll.regeln.prozentsummeNichtHundert',
    })
  }

  return { summe, verstoesse }
}

/** The same judgement, reading the run's shares out of the answers document. */
export function bewerteGruppe(gruppe: Prozentgruppe, antworten: Antworten): Gruppenbewertung {
  return bewerteAnteile(
    gruppe,
    gruppe.felder.map(({ pfad }) => wertAus(antworten, pfad)),
  )
}

export const pruefeProzentgruppen: Regel = (antworten) =>
  PROZENTGRUPPEN.flatMap((gruppe) => [...bewerteGruppe(gruppe, antworten).verstoesse])
