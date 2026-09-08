/* What the account endpoints send and receive.
 *
 * Load-bearing. These mirror backend/app/api/schemas.py field for field, and
 * feature 3's drafts, feature 11's review workflow, feature 12's queue and
 * feature 16's user administration all read the same account shape. A field
 * added on the backend is added here, in the same names: the JSON keys are the
 * backend's, so ist_aktiv keeps its German name rather than being renamed to
 * something camel-cased on the way in. A rename here would need a mapping layer,
 * and a mapping layer is one more place for the two halves to disagree.
 */

import type { Locale } from '../i18n'

/* The six roles, exactly as backend/app/models/benutzer.py spells them.
 *
 * A const array rather than a TypeScript enum, because tsconfig.app.json sets
 * erasableSyntaxOnly and an enum is not erasable. It also gives us the list at
 * runtime, which is what the header needs to print a tag per role in a fixed
 * order rather than whatever order the server happened to send.
 */
export const ROLLEN = [
  'SUBMITTER',
  'DATA_STEWARD',
  'REVIEWER',
  'SUPER_ADMIN',
  'REGIERUNGSPRAESIDIUM',
  'INTEGRATION',
] as const

export type Rolle = (typeof ROLLEN)[number]

/** The signed-in account, as every screen sees it. */
export interface BenutzerAntwort {
  id: string
  email: string
  rollen: Rolle[]
  /** 1 to 4, and set only on a Regierungspräsidium account. */
  regierungspraesidium: number | null
  locale: Locale
  ist_aktiv: boolean
}

/* The shape every refusal from this API takes.
 *
 * Two fields with two different readers, as backend/app/api/schemas.py puts it:
 * code is for this code, which must never branch on a sentence somebody may
 * reword, and nachricht is for the person.
 */
export interface FehlerAntwort {
  code: string
  nachricht: string
}

/** The sign-in request body. */
export interface AnmeldungAnfrage {
  email: string
  passwort: string
}
