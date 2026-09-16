/* Where a refused move belongs on screen.
 *
 * Three answers, because the three need three different things from the person
 * reading them. A missing Begruendung is the only one a reviewer puts right by
 * typing, so it goes beside the box and nowhere else. Somebody else having
 * decided first needs the current state rather than a retry. Everything else
 * keeps the backend's own sentence, EIGENES_PROTOKOLL and a missing role
 * included: the rail should have prevented both, and if one arrives anyway the
 * server's answer is honest where a guess would not be.
 */

import { ApiFehler, BEGRUENDUNG_FEHLT, UEBERGANG_NICHT_MOEGLICH } from '../../api/fehler'

export type Fehlerstelle = 'begruendung' | 'veraltet' | 'sonst'

export function entscheidungsfehler(fehler: unknown): Fehlerstelle {
  if (!(fehler instanceof ApiFehler)) return 'sonst'

  if (fehler.code === BEGRUENDUNG_FEHLT) return 'begruendung'
  if (fehler.code === UEBERGANG_NICHT_MOEGLICH) return 'veraltet'

  return 'sonst'
}
