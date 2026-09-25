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

/* The accounts whose address contains what was typed.
 *
 * **The address and nothing else**, which is why the box is labelled for the
 * address rather than "Suche": nobody should type a role into it and conclude the
 * list is broken.
 *
 * Order is the endpoint's, which is by email. Narrowing a list must not also
 * reshuffle it under somebody who has just read it.
 */
export function gefilterteKonten(
  konten: readonly BenutzerAntwort[],
  suche: string,
): BenutzerAntwort[] {
  const begriff = suche.trim().toLowerCase()
  if (begriff === '') return [...konten]

  return konten.filter((konto) => konto.email.toLowerCase().includes(begriff))
}
