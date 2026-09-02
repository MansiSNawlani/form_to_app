/* The dropdown contents of the legacy form.
 *
 * The single source is database/seed/form_version_20260609/optionslisten.json,
 * extracted from the PDF by backend/scripts/extract_form_definition.py and
 * regenerated rather than edited. It is aliased in from outside frontend/ on
 * purpose: the backend seeds the FormVersion table from the same file, and a
 * retyped copy here would drift the moment a list changed.
 *
 * wert is what gets stored, because it is what FiaKa receives today. label is
 * only ever shown.
 */

import optionslisten from '@formular/optionslisten.json'

export interface Option {
  wert: string
  label: string
}

/* The lists in the file. Named here so a typo is a build error rather than an
 * empty dropdown or an empty radio group.
 *
 * Each is named for the field it belongs to, except gewaessertyp, which keeps
 * the short name it was first published under. A radio group and a dropdown read
 * the same list in the same shape, so nothing here says which control a list
 * ends up in. */
export type ListenName =
  | 'anlass'
  | 'probestrecke.monitoringnummer'
  | 'gewaessertyp'
  | 'z.rp'
  | 'z.quelle'
  | 'arten'
  | 'besatz_fischart'
  | 'ausruestung.egeraet'
  | 'ausruestung.kathode'
  | 'messdaten.regenfaelle'
  | 'messdaten.truebung'
  | 'messdaten.schaumbildung'
  | 'hydrologie.breite'
  | 'hydrologie.tiefe'
  | 'hydrologie.tiefenvarianz'
  | 'hydrologie.linienfuehrung'
  | 'hydrologie.stroemung'
  | 'hydrologie.fliessgeschwindigkeit'
  | 'hydrologie.wasserfuehrung'
  | 'hydrologie.stillwasserbereich'
  | 'hydrologie.gesamtprofil'

const listen = optionslisten.listen as Record<string, Option[]>

export function optionen(name: ListenName): Option[] {
  return listen[name] ?? []
}
