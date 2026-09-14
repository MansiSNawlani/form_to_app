/* The shapes the workflow travels in.
 *
 * Load-bearing. Feature 11e draws its decision panel and its Verlauf out of
 * exactly these, so anything added here has to be added to
 * backend/app/api/schemas.py in the same breath.
 *
 * The keys are the server's, snake_case included, the same rule
 * protokoll/entwurf/typen.ts already follows: renaming them on the way in needs a
 * mapping layer, and a mapping layer is one more place for the two halves to
 * disagree.
 */

import type { Status } from '../entwurf/typen'

/* The three decisions a reviewer can make, exactly as
 * backend/app/protokolle/uebergang/regeln.py spells them.
 *
 * Named for what the person does rather than for the state it produces. A client
 * that spoke in target states could ask for any of them, and the first one it
 * would ask for is LOCKED.
 */
export type Entscheidung = 'ANNEHMEN' | 'AENDERUNG_ANFORDERN' | 'ABLEHNEN'

/** The two that cannot be made without saying why. */
export const BEGRUENDUNG_NOETIG: readonly Entscheidung[] = ['AENDERUNG_ANFORDERN', 'ABLEHNEN']

/* What a decision sends.
 *
 * No version, unlike a save. A save carries one because two tabs editing the
 * same answers overwrite each other; a decision writes no answer, and two
 * reviewers deciding at once are handled by a row lock on the server.
 */
export interface EntscheidungAnfrage {
  entscheidung: Entscheidung
  kommentar?: string
}

/* Where the protocol ended up: backend/app/api/schemas.py's UebergangAntwort,
 * under the same name, so one payload is not called two things.
 *
 * locked_at is filled in by Annehmen and by nothing else, because accepting and
 * locking are one action.
 */
export interface UebergangAntwort {
  id: string
  status: Status
  locked_at: string | null
}

/* One line of a protocol's history.
 *
 * von_status is null only for a row that arrived some way other than through the
 * application, which nothing writes today. The screen has to survive one anyway.
 *
 * akteur_name is an email address for now. The server names it for what it is
 * meant to be rather than for what it holds, so feature 16 can put a real name
 * behind it without this changing.
 */
export interface VerlaufEintrag {
  id: string
  von_status: Status | null
  nach_status: Status
  kommentar: string | null
  akteur_name: string
  created_at: string
}
