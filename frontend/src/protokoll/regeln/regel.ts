import type { ParseKeys } from 'i18next'
import type { Gruppenpfad } from '../abschnitte/teil3/gruppen'
import type { Einflusspfad } from '../abschnitte/teil4/bloecke'
import type { Paarpfad } from '../abschnitte/teil5/bloecke'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* A rule is a plain function from the answers document to what is wrong with
 * it, holding no React, no Zod and no German. That keeps it testable without a
 * browser, and it lets the backend read the same rule straight across into
 * Pydantic once features 2 and 3 land, because both halves see the same
 * document.
 *
 * A key rather than a sentence, because a sentence built in here could not be
 * translated for feature 17.
 */
export interface Regelverstoss {
  /* Usually a field. A path outside the answers document where the wrong thing
     is a combination rather than any one answer in it: the six percentage runs
     of part 3, whose total is nobody's field, and part 4's Einflüsse block,
     where the contradiction is between two ticks rather than in either. In both
     cases no path in the document names the thing that is wrong, and turning
     every box in the group red for one problem is noise. See gruppen.ts and
     teil4/bloecke.ts. Part 5 adds three more, where the wrong thing is a pair of
     numbers that between them say nothing; see teil5/bloecke.ts. */
  pfad: AntwortPfad | Gruppenpfad | Einflusspfad | Paarpfad
  schluessel: ParseKeys
}

export type Regel = (antworten: Antworten) => Regelverstoss[]

/** Blank is untouched, and untouched is never wrong in a draft. */
export function istLeer(wert: string | undefined): boolean {
  return (wert ?? '').trim() === ''
}

/* One answer out of the document, addressed by its path.
 *
 * A rule that works over a declared run of fields has paths rather than the
 * values behind them, so it needs this. A walk rather than two fixed lookups,
 * because AntwortPfad is any depth the document has: part 1 already nests three
 * deep at probestrecke.gewaesser.vorfluter1.
 *
 * Returns "" for anything missing, which istLeer then reads as untouched. That
 * is the same answer a present-but-empty field gives, and nothing on this form
 * yet distinguishes the two; typen.ts says so.
 */
export function wertAus(antworten: Antworten, pfad: AntwortPfad): string {
  const wert = pfad
    .split('.')
    .reduce<unknown>(
      (aktuell, teil) => (aktuell as Record<string, unknown> | undefined)?.[teil],
      antworten,
    )
  return typeof wert === 'string' ? wert : ''
}
