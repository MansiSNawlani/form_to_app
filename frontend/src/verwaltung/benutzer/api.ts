/* The one call this screen makes.
 *
 * Its own module rather than a fetch inside the query options, for the reason
 * entwurf/api.ts already sets out: the call is what changes if the endpoint moves
 * or grows a parameter, and the caching policy is not.
 */

import { apiAnfrage } from '../../api/client'
import type { Locale } from '../../i18n'
import type { BenutzerAntwort, Rolle } from '../../api/typen'

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

/* A new account, exactly as KontoAnlegenAnfrage in backend/app/api/schemas.py
 * declares it.
 *
 * Field for field rather than loosely, because that model sets extra="forbid": a
 * misspelled name here is refused by the server rather than quietly dropped, and
 * this type is what makes it a build error instead.
 *
 * regierungspraesidium is null rather than absent on an account that has none. On
 * creation the two mean the same thing, unlike KontoAendernAnfrage, where "leave
 * it alone" and "clear it" are different instructions. That distinction belongs
 * to 16d.
 */
export interface KontoAnlegenAnfrage {
  email: string
  passwort: string
  rollen: Rolle[]
  regierungspraesidium: number | null
  locale: Locale
}

/* Create it. 201 with the account, and never the password: the API does not
 * return it, does not log it and does not echo it in a validation error. What the
 * screen shows afterwards is the value the browser already had in hand. */
export function legeKontoAn(anfrage: KontoAnlegenAnfrage): Promise<BenutzerAntwort> {
  return apiAnfrage<BenutzerAntwort>('/benutzer', { methode: 'POST', koerper: anfrage })
}
