import type { ParseKeys } from 'i18next'
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
  pfad: AntwortPfad
  schluessel: ParseKeys
}

export type Regel = (antworten: Antworten) => Regelverstoss[]

/** Blank is untouched, and untouched is never wrong in a draft. */
export function istLeer(wert: string | undefined): boolean {
  return (wert ?? '').trim() === ''
}
