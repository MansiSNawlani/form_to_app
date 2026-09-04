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
  | 'ausruestung.bauweise'
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

/* The same answer is never offered twice.
 *
 * ausruestung.egeraet holds 34 entries, two of which export the identical value
 * keine Angabe under the labels "keine Angabe" and "unbekannt". It is the only
 * list in the form that does this. See docs/ffs-defect-list.md item 12.
 *
 * Collapsing it here rather than in the extraction script is deliberate. The
 * seed file is a faithful record of what is in the PDF and both entries really
 * are, so it keeps them; what a control shows is a display question, and this is
 * the one place display options are resolved.
 *
 * The first label wins, because nothing distinguishes the two: they store the
 * same answer, so the choice between them cannot be recovered later either way.
 */
function ohneDoppelte(eintraege: readonly Option[]): readonly Option[] {
  const gesehen = new Set<string>()
  return eintraege.filter(({ wert }) => {
    if (gesehen.has(wert)) return false
    gesehen.add(wert)
    return true
  })
}

/* Collapsed once, when the module loads, rather than on every call.
 *
 * optionen() is called during render: FeldSuche hands its result straight to an
 * MUI Autocomplete, which for the 722 monitoring numbers means a new array of 722
 * objects on every keystroke and a prop that never compares equal. Doing it here
 * keeps the reference stable, which is what it was before the duplicate needed
 * handling at all. */
const listen: Record<string, readonly Option[]> = Object.fromEntries(
  Object.entries(optionslisten.listen as Record<string, Option[]>).map(
    ([name, eintraege]) => [name, ohneDoppelte(eintraege)],
  ),
)

export function optionen(quelle: Optionsquelle): readonly Option[] {
  /* Options declared in code are returned untouched. They are written by hand a
     few lines from where they are used, so a duplicate there is a typo somebody
     can see, not a fact about a generated file. */
  if (typeof quelle !== 'string') return quelle
  return listen[quelle] ?? []
}
