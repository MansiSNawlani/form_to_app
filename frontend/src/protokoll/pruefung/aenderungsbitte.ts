/* Which change request a returned protocol is answering.
 *
 * Its own module rather than a second export from the component, the way
 * absenden/gruppierung.ts and absenden/verortung.ts are: a plain function over
 * values, testable without a browser, which is what coding-standards.md asks for
 * wherever a wrong answer is available. Picking the wrong entry here is a quiet
 * one, showing the surveyor a correction they made weeks ago and asking for it
 * again.
 */

import type { VerlaufEintrag } from './typen'

/* The most recent change request in a history, or nothing.
 *
 * The most recent, not all of them: a protocol sent back twice carries two, and
 * the older one has already been dealt with. The list arrives newest first from
 * the server, so the first match is the one, and nothing here re-sorts it.
 */
export function letzteAenderungsbitte(
  eintraege: readonly VerlaufEintrag[],
): VerlaufEintrag | undefined {
  return eintraege.find((eintrag) => eintrag.nach_status === 'NEEDS_CHANGES')
}
