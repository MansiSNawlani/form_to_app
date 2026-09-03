import { istLeer, type Regel, type Regelverstoss } from './regel'
import { PROZENTBLOECKE, type Prozentblock } from '../abschnitte/teil3/bloecke'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The six percentage runs of part 3, each of which has to come to exactly 100.
 *
 * Defect 1 in docs/ffs-defect-list.md is why this checks all six. The legacy
 * form keeps a check_ok_ indicator per run and reads five of them at submit,
 * leaving Substratverteilung out, so a substrate distribution totalling 43 is
 * sent and accepted. There is no per-run branch here: a block is a block.
 *
 * The legacy form also refuses the keystroke that would push a run past 100,
 * by setting event.rc = false. We let the value land and say the run is over
 * instead. Refusing the character makes an ordinary correction impossible: at
 * 100 already, the first digit of a replacement cannot be typed until some
 * other share has been cleared. That divergence is also why defect 4, the
 * missing app.alert0 that throws instead of warning on Lehm / Ton, has no
 * equivalent here: there is one code path for all forty-three shares. */

export interface Blockbewertung {
  /** What the run currently adds up to. A blank share counts as 0. */
  summe: number
  verstoesse: readonly Regelverstoss[]
}

/* Whole numbers only, and at most three digits. The legacy form reads these
   with parseInt, and 6a set min, max and step on the input, so anything else
   can only arrive by paste or by hand-editing a saved draft. */
const GANZER_PROZENTWERT = /^\d{1,3}$/

/* The blocks address their fields by path rather than by walking the document,
   so the value has to be looked up from one. Written as a walk rather than two
   indexes because part 1 nests three deep (probestrecke.gewaesser.vorfluter1)
   and a later block may too. */
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
 * Split from bewerteBlock so the running total on screen and the document's
 * validity are the same arithmetic. Blocksumme has the values already, out of a
 * useWatch scoped to its own run, and rebuilding an answers document from them
 * just to take it apart again would be the kind of second implementation that
 * drifts. */
export function bewerteAnteile(
  block: Prozentblock,
  werte: readonly (string | undefined)[],
): Blockbewertung {
  const verstoesse: Regelverstoss[] = []
  let summe = 0
  let angefasst = false

  for (const [index, { pfad }] of block.felder.entries()) {
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
      pfad: block.id,
      schluessel: 'protokoll.regeln.prozentsummeNichtHundert',
    })
  }

  return { summe, verstoesse }
}

/** The same judgement, reading the run's shares out of the answers document. */
export function bewerteBlock(block: Prozentblock, antworten: Antworten): Blockbewertung {
  return bewerteAnteile(
    block,
    block.felder.map(({ pfad }) => wertAus(antworten, pfad)),
  )
}

export const pruefeProzentbloecke: Regel = (antworten) =>
  PROZENTBLOECKE.flatMap((block) => [...bewerteBlock(block, antworten).verstoesse])
