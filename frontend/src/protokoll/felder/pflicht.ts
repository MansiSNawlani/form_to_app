/* Which answers this form insists on, read from the same file the server reads.
 *
 * The single source is database/seed/form_version_20260609/pflichtfelder.json,
 * aliased in from outside frontend/ exactly as the option lists are, and for a
 * stronger reason. The backend enforces that list at submit; this side draws the
 * asterisk that promises it. When the two were kept separately, which they were
 * until feature 11c, they drifted, and the drift was invisible: a field marked
 * required on screen that nothing actually checks looks exactly like one that
 * works, and the surveyor finds out later or never.
 *
 * Unlike the other two files in that directory this one is hand-authored. The
 * PDF's field definition carries no required flag at all, so requiredness is a
 * decision rather than an extraction; the reasoning is in
 * blueprint/context/pflichtfelder-vorschlag.md.
 *
 * **Only the plain requirements are here.** A list cannot say "the dam's slope is
 * required when there is a dam", or "at least one of these ticks". Those are
 * conditions, they live in protokoll/regeln/ beside the other rules, and a field
 * under one of them passes its own answer to FeldRahmen's pflicht prop.
 */

import pflichtfelder from '@formular/pflichtfelder.json'

const PFLICHT: ReadonlySet<string> = new Set(pflichtfelder.pflichtfelder)

/** Does the form insist on this answer, whatever else is in the protocol? */
export function istPflichtfeld(pfad: string): boolean {
  return PFLICHT.has(pfad)
}

/** Every one of them, for the test that holds this side to the server's list. */
export function pflichtfelderListe(): readonly string[] {
  return pflichtfelder.pflichtfelder
}
