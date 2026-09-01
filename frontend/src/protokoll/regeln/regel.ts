import type { ParseKeys } from 'i18next'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* What every rule on the protocol looks like.
 *
 * A rule is a plain function from the answers document to what is wrong with
 * it, with no React, no Zod and no German in it. coding-standards.md asks for
 * that so a rule is testable without a browser; here it also means the rule can
 * be read straight across into Pydantic once features 2 and 3 give the backend
 * its half of the validation, because both halves see the same document.
 *
 * The message is a translation key rather than a sentence. A sentence built
 * inside a rule could not be translated for feature 17, and could not be shown
 * by a component that is not allowed to hold German text.
 */
export interface Regelverstoss {
  pfad: AntwortPfad
  schluessel: ParseKeys
}

export type Regel = (antworten: Antworten) => Regelverstoss[]

/** An answer nobody has given yet. Blank is untouched, not wrong. */
export function istLeer(wert: string | undefined): boolean {
  return (wert ?? '').trim() === ''
}
