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
  | 'ufer.randstreifen'

/* Where a control's options come from: a list in the seed file, named, or a set
 * declared in code.
 *
 * Almost always the former, and the name is what keeps it honest. The one
 * exception so far is part 4's 0 to 3 scale for the Strukturen. The legacy form
 * stores those eight answers as free text, so the PDF holds no export values for
 * them and the four steps exist only as a line of prose printed above the block.
 * Writing them into optionslisten.json would put invented data in a generated
 * file and would tell the extraction script's pairing guard nothing, so they are
 * declared beside the block that uses them instead.
 *
 * A string is still checked against ListenName, so a mistyped list name stays a
 * build error rather than an empty control. */
export type Optionsquelle = ListenName | readonly Option[]

const listen = optionslisten.listen as Record<string, Option[]>

export function optionen(quelle: Optionsquelle): readonly Option[] {
  if (typeof quelle !== 'string') return quelle
  return listen[quelle] ?? []
}
