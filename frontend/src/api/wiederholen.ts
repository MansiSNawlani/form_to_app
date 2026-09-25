/* Whether a failed read is worth trying again.
 *
 * One policy for every list in this application. It lived in
 * pruefliste/abfragen.ts from feature 12b, where it was the only caller; feature
 * 16b's account list needed exactly the same rule and copying it would have made
 * a retry policy something two files could disagree about.
 *
 * Its own module rather than a method on anything, so it can be held to its
 * promise without React, which is what coding-standards.md asks wherever a wrong
 * answer is possible. Both wrong answers cost something. Retrying a refusal makes
 * somebody wait through three requests for the same no, and the answer they are
 * waiting for is not an error they can act on. Giving up on a dropped request
 * shows a failure to somebody whose next attempt would have worked.
 */

import { ApiFehler, NICHT_ANGEMELDET, ROLLE_FEHLT } from './fehler'

const VERSUCHE = 2

export function sollWiederholen(anzahl: number, fehler: Error): boolean {
  if (fehler instanceof ApiFehler) {
    // Both are settled answers about the caller rather than about the request.
    if (fehler.code === ROLLE_FEHLT || fehler.code === NICHT_ANGEMELDET) return false
  }
  return anzahl < VERSUCHE
}
