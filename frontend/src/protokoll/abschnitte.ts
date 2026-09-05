/* The six sections of the protocol, in the order the legacy PDF prints them.
 *
 * The order is fixed but the route through them is not: project-overview.md
 * requires that any section can be opened at any time. Forcing surveyors through
 * in sequence is what makes people type a placeholder value to get past a gate
 * and never come back.
 *
 * Each entry carried a `feature` number until 9a, naming the build-plan item
 * that would fill the section. Section 6 was the last unbuilt one, so the
 * placeholder that read it is gone and the number went with it.
 */

export const ABSCHNITTE = [
  { nr: 1, titelKey: 'protokoll.abschnitte.anlass' },
  { nr: 2, titelKey: 'protokoll.abschnitte.messdaten' },
  { nr: 3, titelKey: 'protokoll.abschnitte.umland' },
  { nr: 4, titelKey: 'protokoll.abschnitte.struktur' },
  { nr: 5, titelKey: 'protokoll.abschnitte.ausruestung' },
  { nr: 6, titelKey: 'protokoll.abschnitte.faenge' },
] as const

export type Abschnitt = (typeof ABSCHNITTE)[number]

export function findeAbschnitt(nr: string | undefined): Abschnitt | undefined {
  return ABSCHNITTE.find((abschnitt) => String(abschnitt.nr) === nr)
}

export function abschnittPfad(entwurfId: string, nr: number): string {
  return `/protokolle/${entwurfId}/abschnitt/${nr}`
}
