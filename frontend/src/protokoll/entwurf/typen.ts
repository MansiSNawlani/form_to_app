/* The shape of a protocol while it is being filled in.
 *
 * Load-bearing. Features 4b to 9 add their fields to Antworten, and feature 3
 * sends this same document to the server, so the envelope deliberately mirrors
 * the Submission columns in project-overview.md: matching shapes make feature 3
 * a plumbing change rather than a reshape of every form component.
 */

/** ADR 0004: a submission is never migrated to a later form version. */
export const FORM_VERSION = '20260609'

/* Answers nested so that each path spells out the legacy PDF field path exactly:
 * probestrecke.gewaesser.vorfluter1, messdaten.uhrzeit, and so on. React Hook
 * Form addresses a field by its dotted name, so a field registered under its
 * legacy path writes to the right place with no mapping layer, and the eventual
 * FiaKa transfer stays a direct match.
 *
 * Every key is optional because a draft is incomplete by definition. Required
 * means "required to submit", which is feature 11's gate.
 *
 * Only anlass exists so far. Feature 4b adds the rest of part 1 and features 5
 * to 9 add their own groups, each at its own legacy path.
 */
export interface Antworten {
  anlass?: string
}

export interface Entwurf {
  id: string
  formVersion: string
  angelegtAm: string
  geaendertAm: string
  antworten: Antworten
}
