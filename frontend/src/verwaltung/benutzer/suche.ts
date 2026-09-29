/* Narrowing the account list, worked out without a browser.
 *
 * **The filtering happens here rather than on the server**, which is the other
 * half of a decision feature 16a made: its endpoint takes no search parameter and
 * returns every account, because accounts are tens rather than unbounded. So the
 * whole list is already in hand and narrowing it costs no request. The review
 * queue does the opposite, and for the opposite reason: protocols grow without
 * bound, so the server filters those.
 */

import type { BenutzerAntwort } from '../../api/typen'

/* The three answers the status filter offers, added on 2026-09-28.
 *
 * An account is never deleted in this application, only locked, so "gesperrt" is
 * not a rare corner: it is where every account that somebody has finished with
 * ends up, and the list only grows. The question an administrator actually
 * arrives with is "somebody cannot sign in, is their account locked", and
 * scanning a column of badges for it is what this replaces.
 *
 * A list rather than a bare union so the control can be built from it, which is
 * what keeps the options offered and the values accepted the same set.
 */
export const KONTOSTATUS = ['alle', 'aktiv', 'gesperrt'] as const

export type Kontostatus = (typeof KONTOSTATUS)[number]

/* The accounts that match both the typed address and the chosen status.
 *
 * **The address and nothing else**, for the search half, which is why the box is
 * labelled for the address rather than "Suche": nobody should type a role into it
 * and conclude the list is broken.
 *
 * **One function for both**, rather than one per filter applied in turn by the
 * page. How many rows are showing is a single question, and the count beside the
 * search box answers it; two functions would let the page ask it of one filter and
 * report the other.
 *
 * The two narrow, never replace. An address that matches while the status does not
 * is not a row, which is the case a filter written as "either" would get wrong.
 *
 * Order is the endpoint's, which is by email. Narrowing a list must not also
 * reshuffle it under somebody who has just read it.
 */
export function gefilterteKonten(
  konten: readonly BenutzerAntwort[],
  suche: string,
  status: Kontostatus,
): BenutzerAntwort[] {
  const begriff = suche.trim().toLowerCase()

  return konten.filter((konto) => {
    if (begriff !== '' && !konto.email.toLowerCase().includes(begriff)) return false
    if (status === 'aktiv' && !konto.ist_aktiv) return false
    if (status === 'gesperrt' && konto.ist_aktiv) return false
    return true
  })
}
