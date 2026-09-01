/* The six sections of the protocol, in the order the legacy PDF prints them.
 *
 * The order is fixed but the route through them is not: project-overview.md
 * requires that any section can be opened at any time. Forcing surveyors through
 * in sequence is what makes people type a placeholder value to get past a gate
 * and never come back.
 *
 * `feature` is the build-plan item that fills the section, which the placeholder
 * bodies show until it does.
 */

export const ABSCHNITTE = [
  { nr: 1, titelKey: 'protokoll.abschnitte.anlass', feature: 4 },
  { nr: 2, titelKey: 'protokoll.abschnitte.messdaten', feature: 5 },
  { nr: 3, titelKey: 'protokoll.abschnitte.umland', feature: 6 },
  { nr: 4, titelKey: 'protokoll.abschnitte.struktur', feature: 7 },
  { nr: 5, titelKey: 'protokoll.abschnitte.ausruestung', feature: 8 },
  { nr: 6, titelKey: 'protokoll.abschnitte.faenge', feature: 9 },
] as const

export type Abschnitt = (typeof ABSCHNITTE)[number]

export function findeAbschnitt(nr: string | undefined): Abschnitt | undefined {
  return ABSCHNITTE.find((abschnitt) => String(abschnitt.nr) === nr)
}

export function abschnittPfad(entwurfId: string, nr: number): string {
  return `/protokolle/${entwurfId}/abschnitt/${nr}`
}
