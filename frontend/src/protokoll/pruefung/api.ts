/* The three calls the workflow needs.
 *
 * Thin on purpose, exactly like protokoll/entwurf/api.ts: a path, a method and a
 * type each. The cookie, the JSON and turning a refusal into a typed error are
 * api/client.ts's job, and what to do about a failure is the caller's.
 *
 * Two of these are a reviewer's and one is not. The Verlauf is read by the
 * surveyor as well, and needs to be: it is where they find out what a reviewer
 * asked them to correct.
 */

import { apiAnfrage } from '../../api/client'
import type { EntscheidungAnfrage, UebergangAntwort, VerlaufEintrag } from './typen'

const PFAD = '/protokolle'

interface MitFetch {
  fetchImpl?: typeof fetch
}

/* Take a submitted protocol into Pruefung.
 *
 * A courtesy to colleagues rather than a lock. Nothing reserves a protocol to the
 * reviewer who took it, and a decision can be made straight from SUBMITTED
 * without this step at all.
 */
export function nimmInPruefung(
  id: string,
  { fetchImpl }: MitFetch = {},
): Promise<UebergangAntwort> {
  return apiAnfrage<UebergangAntwort>(`${PFAD}/${encodeURIComponent(id)}/pruefung`, {
    methode: 'POST',
    fetchImpl,
  })
}

/* Accept a protocol, send it back for correction, or reject it.
 *
 * One call for the three, because the reviewer screen is one radio group and one
 * button.
 *
 * Rejects with BEGRUENDUNG_FEHLT when a rejection or a change request arrives
 * without a reason, EIGENES_PROTOKOLL when the account filed the protocol itself,
 * and UEBERGANG_NICHT_MOEGLICH when somebody else has already decided. Only the
 * first is something the reviewer can put right by typing.
 */
export function entscheide({
  id,
  entscheidung,
  kommentar,
  fetchImpl,
}: EntscheidungAnfrage & MitFetch & { id: string }): Promise<UebergangAntwort> {
  const koerper: EntscheidungAnfrage = { entscheidung, kommentar }

  return apiAnfrage<UebergangAntwort>(`${PFAD}/${encodeURIComponent(id)}/entscheidung`, {
    methode: 'POST',
    koerper,
    fetchImpl,
  })
}

/* Everything that has happened to one protocol, newest first.
 *
 * Newest first is the server's order, not something to sort here: it is the order
 * the reviewer mockup prints and the order anybody reads a history.
 */
export function holeVerlauf(
  id: string,
  { fetchImpl }: MitFetch = {},
): Promise<VerlaufEintrag[]> {
  return apiAnfrage<VerlaufEintrag[]>(`${PFAD}/${encodeURIComponent(id)}/verlauf`, {
    fetchImpl,
  })
}
