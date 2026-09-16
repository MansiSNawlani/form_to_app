/* Where a refused decision belongs on screen.
 *
 * Three answers, because the three need three different things from the person
 * reading them, and putting them all in one place at the top of the panel would
 * make two of them useless:
 *
 * - **begruendung** is the only one a reviewer puts right by typing, so it goes
 *   beside the box and nowhere else.
 * - **veraltet** is somebody else having decided first. Nothing was typed wrong
 *   and pressing again cannot help; the way out is to load the protocol afresh.
 * - **sonst** keeps the backend's own sentence, which already names the thing,
 *   says why and says what to do. EIGENES_PROTOKOLL and a missing role land here:
 *   the rail should have prevented both, and if one arrives anyway the honest
 *   answer is the server's, not a guess.
 *
 * A plain function over a value, so it can be tested without a browser, which is
 * what coding-standards.md asks wherever a wrong answer is possible. The wrong
 * answer available here is putting a message where nobody will act on it.
 */

import { ApiFehler, BEGRUENDUNG_FEHLT, UEBERGANG_NICHT_MOEGLICH } from '../../api/fehler'

export type Fehlerstelle = 'begruendung' | 'veraltet' | 'sonst'

export function entscheidungsfehler(fehler: unknown): Fehlerstelle {
  if (!(fehler instanceof ApiFehler)) return 'sonst'

  if (fehler.code === BEGRUENDUNG_FEHLT) return 'begruendung'
  if (fehler.code === UEBERGANG_NICHT_MOEGLICH) return 'veraltet'

  return 'sonst'
}
