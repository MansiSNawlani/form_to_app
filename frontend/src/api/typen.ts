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
  /* Only a refused submit fills this in, so it is absent from every other
     refusal and the two-field shape above still describes them. */
  verstoesse?: Verstoss[] | null
}

/* One thing wrong with a protocol somebody tried to submit.
 *
 * A path and a key, never a sentence. The German for all 29 of these already
 * lives under protokoll.regeln in our own locale file, put there by the form's
 * own rules, so the backend sends the key and the panel looks it up. That is
 * what keeps one wording rather than two, and what lets feature 17 translate
 * them once.
 *
 * pfad is a dotted path into the answers document, such as
 * probestrecke.gewaesser.name, or one of the four pseudo-paths the rules use
 * where the wrong thing is a combination rather than a single field. Every field
 * on the form carries its path as its DOM id, which is what lets the panel link
 * straight to the control.
 */
export interface Verstoss {
  pfad: string
  schluessel: string
}

/** The sign-in request body. */
export interface AnmeldungAnfrage {
  email: string
  passwort: string
}

/* The protocol endpoints' own shapes are not here. They live beside Antworten in
   protokoll/entwurf/typen.ts, because every one of them carries or describes
   that document and splitting them across two files would mean reading both to
   understand either. They mirror backend/app/api/schemas.py just as these do. */
