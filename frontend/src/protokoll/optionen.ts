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

/* The nine lists in the file. Named here so a typo is a build error rather than
 * an empty dropdown. */
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

const listen = optionslisten.listen as Record<string, Option[]>

export function optionen(name: ListenName): Option[] {
  return listen[name] ?? []
}
