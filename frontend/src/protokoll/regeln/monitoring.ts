import { istLeer, type Regel } from './regel'

/* Only a monitoring programme assigns a Monitoringstrecken-Nr., so only a
   monitoring Anlass may demand one. These are two of the six export values in
   the extracted Anlass list; project-overview.md states the rule as "values
   containing wrrl or ffh make monitoringstrecke_nr required", and since none of
   the other four values contain either word, matching them exactly is the same
   rule without the looseness. */
const MONITORING_ANLAESSE = ['wrrl', 'ffh']

/** Whether this Anlass makes the Monitoringstrecken-Nr. mandatory. */
export function istMonitoringAnlass(anlass: string | undefined): boolean {
  return MONITORING_ANLAESSE.includes(anlass ?? '')
}

export const pruefeMonitoringnummer: Regel = (antworten) => {
  if (!istMonitoringAnlass(antworten.anlass)) return []
  if (!istLeer(antworten.probestrecke?.monitoringnummer)) return []

  return [
    {
      pfad: 'probestrecke.monitoringnummer',
      schluessel: 'protokoll.regeln.monitoringnummerPflicht',
    },
  ]
}
