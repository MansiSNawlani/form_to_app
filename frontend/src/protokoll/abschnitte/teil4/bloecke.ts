import type { ParseKeys } from 'i18next'
import type { AntwortPfad } from '../../entwurf/typen'

/* The runs of part 4, declared once and rendered by mapping.
 *
 * The same shape and the same reasoning as teil3/gruppen.ts, which this file
 * should be read alongside. Part 4 is four runs of near-identical controls:
 * eight ratings, fifteen use checkboxes, four fishery checkboxes and four
 * stocking rows. Thirty-nine of the section's forty-three fields.
 *
 * Declared as data for two reasons. Antworten is a TypeScript interface and is
 * gone at build time, so an array is the only thing bloecke.test.ts can check
 * against felder.json, which is what proves these paths match the legacy form.
 * And thirty-nine near-identical JSX elements is the repetition
 * coding-standards.md rules out.
 *
 * Typed as AntwortPfad, so a path that is not in the answers document is a build
 * error. The test covers the other direction, a path that is in the document but
 * not in the legacy form.
 *
 * Unlike teil3/gruppen.ts, nothing here carries a group id or a total. Nothing
 * in part 4 is added up, so a run is a legend and a list of fields.
 *
 * The four fields that are not here differ from one another, so a shared
 * definition would buy nothing: the two "sonstige" free-text boxes, the
 * Fischereiausübungsberechtigter and the remarks box at the foot of the page.
 * They are written out in their components and checked by hand.
 */

export interface Blockfeld {
  pfad: AntwortPfad
  labelKey: ParseKeys
}

/* What grows and lies in the water, rated 0 to 3 on the scale in stufen.ts.
 *
 * In the order page 2 prints them, four across and then four across, confirmed
 * by widget position rather than by the order the PDF lists the fields in.
 *
 * Two paths here read like section 3 fields and are not.
 * strukturen.wurzeln_strukturen is roots in the water, while ufer.wurzeln is the
 * share of bank with roots reaching in. strukturen.schilf is reeds in the water,
 * printed "Schilf / Röhricht", while ufer.schilf_rohr is reeds on the bank,
 * printed "Schilf / Rohr". */
export const STRUKTUREN: readonly Blockfeld[] = [
  { pfad: 'strukturen.totholz', labelKey: 'protokoll.abschnitt4.strukturen.feld.totholz' },
  {
    pfad: 'strukturen.wurzeln_strukturen',
    labelKey: 'protokoll.abschnitt4.strukturen.feld.wurzeln',
  },
  { pfad: 'strukturen.aeste', labelKey: 'protokoll.abschnitt4.strukturen.feld.aeste' },
  { pfad: 'strukturen.schilf', labelKey: 'protokoll.abschnitt4.strukturen.feld.schilf' },
  {
    pfad: 'strukturen.submerse_makrophyten',
    labelKey: 'protokoll.abschnitt4.strukturen.feld.submerseMakrophyten',
  },
  {
    pfad: 'strukturen.schwimmblattpflanzen',
    labelKey: 'protokoll.abschnitt4.strukturen.feld.schwimmblattpflanzen',
  },
  {
    pfad: 'strukturen.emerse_makrophyten',
    labelKey: 'protokoll.abschnitt4.strukturen.feld.emerseMakrophyten',
  },
  {
    pfad: 'strukturen.sonstige_strukturen',
    labelKey: 'protokoll.abschnitt4.strukturen.feld.sonstigeStrukturen',
  },
]

/* What the water is used for, as fifteen ticks. In the order page 2 prints
   them, five across and then five and five, confirmed by widget position.

   "keine (erkennbar)" and "unbekannt" sit at the head of the run as two of the
   fifteen, not as a separate control, because that is how the form prints them
   and because nothing here makes them exclusive with the rest. */
export const EINFLUESSE: readonly Blockfeld[] = [
  {
    pfad: 'einfluesse.keine_einfluesse',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.keine',
  },
  {
    pfad: 'einfluesse.unbekannt_einfluesse',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.unbekannt',
  },
  { pfad: 'einfluesse.wasserkraft', labelKey: 'protokoll.abschnitt4.einfluesse.feld.wasserkraft' },
  { pfad: 'einfluesse.stauhaltung', labelKey: 'protokoll.abschnitt4.einfluesse.feld.stauhaltung' },
  {
    pfad: 'einfluesse.schwallbetrieb',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.schwallbetrieb',
  },
  { pfad: 'einfluesse.schifffahrt', labelKey: 'protokoll.abschnitt4.einfluesse.feld.schifffahrt' },
  {
    pfad: 'einfluesse.bewaesserung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.bewaesserung',
  },
  {
    pfad: 'einfluesse.entwaesserung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.entwaesserung',
  },
  {
    pfad: 'einfluesse.hochwasserrueckhaltung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.hochwasserrueckhaltung',
  },
  {
    pfad: 'einfluesse.hochwasserablauf',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.hochwasserablauf',
  },
  { pfad: 'einfluesse.badebetrieb', labelKey: 'protokoll.abschnitt4.einfluesse.feld.badebetrieb' },
  { pfad: 'einfluesse.viehtraenke', labelKey: 'protokoll.abschnitt4.einfluesse.feld.viehtraenke' },
  {
    pfad: 'einfluesse.holzberieselung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.holzberieselung',
  },
  {
    pfad: 'einfluesse.trinkwasserversorgung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.trinkwasserversorgung',
  },
  {
    pfad: 'einfluesse.sonstige_Nutzung',
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.sonstigeNutzung',
  },
]

/* How the water is fished, as four ticks. Any number may be true: a stretch can
   be angled and also feed a pond.

   Every path here is bewirschaftung, without the second t, which is the legacy
   form's own misspelling of the heading it prints. Kept deliberately. See
   defect 10 in docs/ffs-defect-list.md, and the note in typen.ts. */
export const BEWIRTSCHAFTUNG: readonly Blockfeld[] = [
  {
    pfad: 'bewirschaftung.angelfischerei',
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.feld.angelfischerei',
  },
  {
    pfad: 'bewirschaftung.berufsfischerei',
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.feld.berufsfischerei',
  },
  {
    pfad: 'bewirschaftung.teichspeisung',
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.feld.teichspeisung',
  },
  {
    pfad: 'bewirschaftung.teichablauf',
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.feld.teichablauf',
  },
]

/* One year's stocking: which fish went in, at what size, and when.

   Four fixed rows, because the printed form has exactly four and the legacy
   paths are numbered besatz1 to besatz4. There is no add-a-row button and there
   should not be one.

   The digit moves, and this is the legacy form's own inconsistency rather than a
   transcription slip: the species field is besatz_fischart1 while its two
   neighbours are besatz1_groessenklassen and besatz1_jahr.

   A row is a group of three unlike fields rather than a run of alike ones, so it
   is typed as a record with named parts. bloecke.test.ts checks all twelve paths
   the same way it checks the runs. */
export interface Besatzzeile {
  /** Shown in the row's legend, so "Jahr" can stay "Jahr" in all four rows. */
  nr: number
  fischart: AntwortPfad
  groessenklassen: AntwortPfad
  jahr: AntwortPfad
}

export const BESATZZEILEN: readonly Besatzzeile[] = [
  {
    nr: 1,
    fischart: 'bewirschaftung.besatz_fischart1',
    groessenklassen: 'bewirschaftung.besatz1_groessenklassen',
    jahr: 'bewirschaftung.besatz1_jahr',
  },
  {
    nr: 2,
    fischart: 'bewirschaftung.besatz_fischart2',
    groessenklassen: 'bewirschaftung.besatz2_groessenklassen',
    jahr: 'bewirschaftung.besatz2_jahr',
  },
  {
    nr: 3,
    fischart: 'bewirschaftung.besatz_fischart3',
    groessenklassen: 'bewirschaftung.besatz3_groessenklassen',
    jahr: 'bewirschaftung.besatz3_jahr',
  },
  {
    nr: 4,
    fischart: 'bewirschaftung.besatz_fischart4',
    groessenklassen: 'bewirschaftung.besatz4_groessenklassen',
    jahr: 'bewirschaftung.besatz4_jahr',
  },
]

/* Where the Einflüsse block's own message lives.
 *
 * Outside the answers document, exactly as a Prozentgruppe's total is, and for
 * the same two reasons. No field names the combination: the contradiction is
 * between "keine (erkennbar)" and whatever else is ticked, not in either of
 * them. And fifteen checkboxes turned red for one contradiction is noise.
 *
 * It is also genuinely unknowable which tick is the wrong one. Only the surveyor
 * knows whether they meant "keine (erkennbar)" or meant "Wasserkraft". */
export type Einflusspfad = 'widerspruch.einfluesse'

export const EINFLUSS_WIDERSPRUCH: Einflusspfad = 'widerspruch.einfluesse'

/* The two blanket answers. Each says the list below it is empty, so neither can
   stand beside a named use, and they cannot stand beside each other. */
export const BLANKETT_EINFLUESSE = [
  'einfluesse.keine_einfluesse',
  'einfluesse.unbekannt_einfluesse',
] as const satisfies readonly AntwortPfad[]

/* The thirteen named uses, which are the rest of the run. Derived rather than
   listed again, so a use added to EINFLUESSE cannot be forgotten here. */
export const NUTZUNGEN: readonly AntwortPfad[] = EINFLUESSE.map(({ pfad }) => pfad).filter(
  (pfad) => !(BLANKETT_EINFLUESSE as readonly AntwortPfad[]).includes(pfad),
)
