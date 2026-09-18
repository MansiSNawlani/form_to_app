/* The one call this screen makes.
 *
 * Its own module rather than a fetch inside the query options, for the reason
 * entwurf/api.ts already sets out: the call is what changes if the endpoint moves
 * or grows a parameter, and the caching policy is not.
 */

import { apiAnfrage } from '../../api/client'
import { alsEndpunktParameter, type Prueflistenabfrage } from './parameter'
import type { Prueflistenseite } from './typen'

export function holePruefliste(abfrage: Prueflistenabfrage): Promise<Prueflistenseite> {
  return apiAnfrage<Prueflistenseite>(`/pruefliste?${alsEndpunktParameter(abfrage)}`)
}
