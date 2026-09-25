/* The order the six roles are printed in, decided once.
 *
 * Lifted out of SiteHeader in feature 16b, when the account list became the
 * second place that prints somebody's roles. The header had been filtering
 * ROLLEN inline, which was right while it was the only caller and becomes two
 * chances to disagree the moment there is a second one: a Super Admin looking at
 * their own row and at their own header tag should not see the same two roles in
 * two orders.
 *
 * A plain function over a list, so it can be held to its promise without React,
 * which is what coding-standards.md asks wherever a wrong answer is possible.
 */

import { ROLLEN, type Rolle } from '../api/typen'

/* The account's roles, in the order ROLLEN declares rather than the order the
 * server sent.
 *
 * The server's order is whatever the database returned, which is not promised to
 * be stable between two reads of the same row. Walking our own list instead means
 * two accounts holding the same roles always read the same way round, and one
 * account reads the same way twice.
 *
 * Anything the account holds that is not a known role is dropped rather than
 * printed. A role this build has never heard of has no label to print and no
 * meaning to convey, so a raw enum name in the middle of a row would be worse
 * than a gap. That can only happen against a newer backend, which is exactly when
 * a screen should degrade quietly.
 */
export function sortierteRollen(rollen: readonly Rolle[]): Rolle[] {
  return ROLLEN.filter((rolle) => rollen.includes(rolle))
}
