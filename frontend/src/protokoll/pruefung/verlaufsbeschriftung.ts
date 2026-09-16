/* What one line of a protocol's history is called.
 *
 * A key, not a word, so this stays a plain function with no i18next in it. The
 * same arrangement liste/anzeige.ts and api/fehler.ts already use, and for the
 * same reason: a function reaching for the translator could not be tested
 * without initialising one.
 *
 * **Read from nach_status, never from von_status.** Where a protocol ended up is
 * what happened to it, and it is the only field that always carries a meaning: a
 * re-submission after a correction is Eingereicht again, which is correct,
 * because it is the same action, and von_status is null on any row that arrived
 * some way other than through this application.
 */

import type { ParseKeys } from 'i18next'
import type { Status } from '../entwurf/typen'

/* A backend newer than this build can send a state this one has never heard of.
   A generic sentence is worth having; a raw key printed at a reviewer is not. */
const UNBEKANNT = 'protokoll.verlauf.aktion.unbekannt' satisfies ParseKeys

/* Partial rather than complete on purpose. A Record<Status, ...> would make the
   lookup above provably total and the fallback dead, which is exactly the
   guarantee the server cannot give us. */
const AKTIONEN: Partial<Record<Status, ParseKeys>> = {
  DRAFT: 'protokoll.verlauf.aktion.DRAFT',
  SUBMITTED: 'protokoll.verlauf.aktion.SUBMITTED',
  IN_REVIEW: 'protokoll.verlauf.aktion.IN_REVIEW',
  NEEDS_CHANGES: 'protokoll.verlauf.aktion.NEEDS_CHANGES',
  REJECTED: 'protokoll.verlauf.aktion.REJECTED',
  ACCEPTED: 'protokoll.verlauf.aktion.ACCEPTED',
  LOCKED: 'protokoll.verlauf.aktion.LOCKED',
}

export function verlaufsbeschriftung(nachStatus: Status): ParseKeys {
  return AKTIONEN[nachStatus] ?? UNBEKANNT
}
