import type { ParseKeys } from 'i18next'
import type { Gruppenpfad } from '../abschnitte/teil3/gruppen'
import type { Einflusspfad } from '../abschnitte/teil4/bloecke'
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
     teil4/bloecke.ts. */
  pfad: AntwortPfad | Gruppenpfad | Einflusspfad
  schluessel: ParseKeys
}

export type Regel = (antworten: Antworten) => Regelverstoss[]

/** Blank is untouched, and untouched is never wrong in a draft. */
export function istLeer(wert: string | undefined): boolean {
  return (wert ?? '').trim() === ''
}
