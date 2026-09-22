/* A queue, as an address.
 *
 * Two paths built from one selection, so the link into a protocol and the crumb
 * back out of it spell the same list the same way. Both go through
 * alsSuchparameter rather than assembling a query string of their own: the
 * address bar, a shared link and a Pruefen button have to mean the same thing,
 * and a second spelling is how they stop meaning it.
 *
 * **This is what lets a reviewer walk the queue at all.** The reviewer's screen
 * has no list of its own; what it knows about the queue is what the address it
 * was opened with carries. A Pruefen button that dropped the filters would leave
 * that screen guessing, and Vorheriges and Naechstes would step through a list
 * nobody asked for.
 *
 * Plain values in and out, no React and no router, so both can be held to their
 * promise without a browser.
 */

import { PRUEFLISTE } from '../../auth/startseite'
import { alsSuchparameter, type Prueflistenabfrage } from './parameter'

/* A selection at its defaults writes no query string at all, and the path is
   then bare. An empty "?" would be a second spelling of the same list. */
function mitAbfrage(pfad: string, abfrage: Prueflistenabfrage): string {
  const parameter = alsSuchparameter(abfrage).toString()
  return parameter === '' ? pfad : `${pfad}?${parameter}`
}

/** The queue itself, narrowed and ordered as it was. */
export function prueflistenPfad(abfrage: Prueflistenabfrage): string {
  return mitAbfrage(PRUEFLISTE, abfrage)
}

/** One protocol's reviewer screen, carrying the queue it was opened from. */
export function pruefungsPfad(id: string, abfrage: Prueflistenabfrage): string {
  return mitAbfrage(`/protokolle/${id}/pruefung`, abfrage)
}
