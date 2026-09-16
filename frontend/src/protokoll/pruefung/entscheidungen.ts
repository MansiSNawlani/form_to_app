/* What the reviewer's rail is allowed to draw.
 *
 * **A copy of backend/app/protokolle/uebergang/regeln.py**, and the only one in
 * this application. That file is the original; change it and change this in the
 * same breath, which entscheidungen.test.ts exists to make a forgotten half fail
 * loudly rather than quietly. Restated rather than fetched for the reason
 * coding-standards.md already writes every form rule twice, once in Zod and once
 * in Pydantic: an endpoint describing four constants would be a request on every
 * page load.
 *
 * **None of this is a permission.** It decides what to draw. Every move is
 * refused again on the server, and hiding a button is not access control.
 */

import type { Rolle } from '../../api/typen'
import type { Status } from '../entwurf/typen'
import type { Entscheidung } from './typen'

/** Who may take a protocol into Pruefung and decide on it. */
const PRUEFERROLLEN: readonly Rolle[] = ['REVIEWER', 'SUPER_ADMIN']

/** The three the API takes on its decision route, in the order the panel lists them. */
export const ENTSCHEIDUNGEN: readonly Entscheidung[] = [
  'ANNEHMEN',
  'AENDERUNG_ANFORDERN',
  'ABLEHNEN',
]

/** Where a decision can be made from. IN_REVIEW is a courtesy, not a gate. */
const ENTSCHEIDBAR: readonly Status[] = ['SUBMITTED', 'IN_REVIEW']

/** Where In Pruefung nehmen works from, which is the one state before it. */
const AUFNEHMBAR: readonly Status[] = ['SUBMITTED']

/* A protocol somebody has already answered. REJECTED and LOCKED are final;
   NEEDS_CHANGES is back with its author; ACCEPTED is in the enum and written by
   nothing, and is here so the list is the whole of what is not decidable rather
   than the part of it anybody remembered. */
const ENTSCHIEDEN: readonly Status[] = ['NEEDS_CHANGES', 'REJECTED', 'ACCEPTED', 'LOCKED']

/** The two where somebody else is being asked to act on the answer. */
const BEGRUENDUNG_NOETIG: readonly Entscheidung[] = ['AENDERUNG_ANFORDERN', 'ABLEHNEN']

export function brauchtBegruendung(entscheidung: Entscheidung): boolean {
  return BEGRUENDUNG_NOETIG.includes(entscheidung)
}

/* The two that end the protocol's journey, because they land it in one of the
   backend's ENDZUSTAENDE: Annehmen writes LOCKED and Ablehnen writes REJECTED,
   and nothing leaves either. Aenderung anfordern is the reversible one, since
   the protocol goes back to its author and comes round again. */
const ENDGUELTIG: readonly Entscheidung[] = ['ANNEHMEN', 'ABLEHNEN']

export function istEndgueltig(entscheidung: Entscheidung): boolean {
  return ENDGUELTIG.includes(entscheidung)
}

/* Which of the four rails this reader gets.
 *
 * Three of them are a sentence and one is the panel. Each says why there is no
 * decision to make here, because a rail that simply left the panel out would
 * leave a reviewer wondering whether the page had failed to load it.
 */
export type Pruefungsrail =
  | { art: 'entscheiden'; kannAufnehmen: boolean }
  | { art: 'entschieden' }
  | { art: 'eigenes' }
  | { art: 'nur_verlauf' }

interface Lage {
  status: Status
  rollen: readonly Rolle[]
  /** Whether the person reading this is the one who filed it. */
  istEigenes: boolean
}

/* The order of these checks is the order the backend's own pruefe_uebergang
 * uses: who you are, then what this particular protocol allows, then the state
 * it is in.
 *
 * With one deliberate difference. Being decided is answered before having filed
 * it, because once a protocol is locked or rejected the useful fact is that it
 * is over, not that this reader could never have been the one to end it.
 */
export function pruefungsrail({ status, rollen, istEigenes }: Lage): Pruefungsrail {
  const darfEntscheiden = rollen.some((rolle) => PRUEFERROLLEN.includes(rolle))
  if (!darfEntscheiden) return { art: 'nur_verlauf' }

  if (ENTSCHIEDEN.includes(status)) return { art: 'entschieden' }

  // A draft, which this screen redirects to the form. Calling it decided would
  // be a lie about it, so the rail says nothing beyond the history.
  if (!ENTSCHEIDBAR.includes(status)) return { art: 'nur_verlauf' }

  if (istEigenes) return { art: 'eigenes' }

  return { art: 'entscheiden', kannAufnehmen: AUFNEHMBAR.includes(status) }
}
