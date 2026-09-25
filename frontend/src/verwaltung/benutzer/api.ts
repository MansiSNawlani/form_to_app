/* The one call this screen makes.
 *
 * Its own module rather than a fetch inside the query options, for the reason
 * entwurf/api.ts already sets out: the call is what changes if the endpoint moves
 * or grows a parameter, and the caching policy is not.
 */

import { apiAnfrage } from '../../api/client'
import type { BenutzerAntwort } from '../../api/typen'

/* Every account, ordered by email, with no parameters at all.
 *
 * Feature 16a decided that deliberately, and the opposite of what 12a decided for
 * protocols: protocols grow without bound and accounts do not. FFS staff plus the
 * external consultants and associations who file protocols is a list of tens,
 * maybe low hundreds, so the whole list comes down once and the search box filters
 * it here rather than asking the server again per keystroke.
 */
export function holeBenutzer(): Promise<BenutzerAntwort[]> {
  return apiAnfrage<BenutzerAntwort[]>('/benutzer')
}
