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

/* One account, for feature 16d's page.
 *
 * Its own request rather than the list filtered down, because a deep link and a
 * reload both have to work: a page that could only draw when the list happened to
 * be in the cache would be a page that works only when you arrive from the list.
 */
export function holeKonto(id: string): Promise<BenutzerAntwort> {
  return apiAnfrage<BenutzerAntwort>(`/benutzer/${id}`)
}

/* A change to an account, exactly as KontoAendernAnfrage in
 * backend/app/api/schemas.py declares it.
 *
 * **Every field is optional, and that is the point.** A field left out is left
 * alone, which is what lets this screen send only what somebody actually changed.
 * Sending the whole form every time would mean two administrators editing
 * different fields overwrote each other, and an account has no version column to
 * catch that.
 *
 * **regierungspraesidium is the one field where null is an instruction.** Absent
 * means "leave the region alone" and null means "clear it", and the backend tells
 * them apart with model_fields_set. The other four refuse a null outright, which
 * is why none of them is typed to accept one: a type allowing it would be a type
 * that can express a request the API rejects.
 */
export interface KontoAendernAnfrage {
  email?: string
  rollen?: Rolle[]
  regierungspraesidium?: number | null
  locale?: Locale
  ist_aktiv?: boolean
}

export function aendereKonto(
  id: string,
  anfrage: KontoAendernAnfrage,
): Promise<BenutzerAntwort> {
  return apiAnfrage<BenutzerAntwort>(`/benutzer/${id}`, { methode: 'PATCH', koerper: anfrage })
}

/* A new password for somebody who has lost theirs.
 *
 * PUT rather than PATCH because it replaces the password outright; there is no
 * partial version of one. The answer is the account and never the password, so
 * what the screen shows afterwards is again the value the browser already had.
 *
 * It does not end the account's existing sessions. The session token is stateless,
 * so one issued before this call stays valid until it expires, up to eight hours.
 * Locking the account is the part that takes effect at once, and the panel on
 * screen has to say so.
 */
export function setzeKontoPasswort(id: string, passwort: string): Promise<BenutzerAntwort> {
  return apiAnfrage<BenutzerAntwort>(`/benutzer/${id}/passwort`, {
    methode: 'PUT',
    koerper: { passwort },
  })
}
