import type { ParseKeys } from 'i18next'
import type { AntwortPfad } from '../../entwurf/typen'

/* The Prozentgruppen of part 3, declared once and rendered by mapping.
 *
 * Parts 1 and 2 write every field out by hand, and at six to fifteen unlike
 * fields that is the readable shape. Part 3 is not that: it is six runs of
 * between four and nine controls differing only in a path and a label.
 *
 * Declared as data for three reasons, in order of weight. The running total is
 * the sum over a group's paths, so writing them out in JSX would mean retyping
 * all forty-three there and keeping two copies in step. Antworten is a
 * TypeScript interface and is gone at build time, so an array is the only thing
 * a test can check against felder.json, which is what proves these paths match
 * the legacy form. And forty-three near-identical JSX elements is the
 * repetition coding-standards.md rules out.
 *
 * Typed as AntwortPfad, so a path that is not in the answers document is a
 * build error. gruppen.test.ts covers the other direction, a path that is in
 * the document but not in the legacy form.
 *
 * Only the percentage runs live here. The Randstreifen radio, the geschütteter
 * Damm pair, the Buhnenbereich and Besonderheiten checkboxes, the Wurzeln box
 * and the two free-text boxes are written out in their components: they differ
 * from one another, so a shared definition would buy nothing.
 */

/* Where a group's own message lives.
 *
 * A wrong total is one problem and gets one message, so it needs somewhere to
 * sit that is not any single share. No path in the answers document names a
 * group: three of the six are under ufer and two under gewaessersohle. So a
 * group carries its own path, outside the document, and regeln/schema.ts raises
 * the violation there.
 *
 * The suffixes are the names of the legacy form's own indicator fields
 * (check_ok_umland and the rest), so the mapping back to the PDF stays legible.
 * The summe prefix is what keeps these clear of the answers: ufer.neigung is a
 * real field, the geschütteter Damm's slope in degrees, and naming this group
 * after itself would have put a group's message on an unrelated box. */
export type Gruppenpfad =
  | 'summe.umland'
  | 'summe.neigung'
  | 'summe.bewuchs'
  | 'summe.uferverbau'
  | 'summe.substrat'
  | 'summe.sohlverbau'

export interface Prozentfeld {
  pfad: AntwortPfad
  labelKey: ParseKeys
}

export interface Prozentgruppe {
  id: Gruppenpfad
  legendKey: ParseKeys
  felder: readonly Prozentfeld[]
}

/** A group path is not a valid id, so summe.umland becomes summe-umland. */
export function summeId(gruppe: Prozentgruppe): string {
  return gruppe.id.replace('.', '-')
}

/* Land use around the stretch. Eight shares of the bank's surroundings, in the
   order page 2 prints them. */
export const UMLAND: Prozentgruppe = {
  id: 'summe.umland',
  legendKey: 'protokoll.abschnitt3.umland.anteile.legend',
  felder: [
    { pfad: 'umland.nadelwald', labelKey: 'protokoll.abschnitt3.umland.feld.nadelwald' },
    { pfad: 'umland.mischwald', labelKey: 'protokoll.abschnitt3.umland.feld.mischwald' },
    { pfad: 'umland.laubwald', labelKey: 'protokoll.abschnitt3.umland.feld.laubwald' },
    { pfad: 'umland.auwald', labelKey: 'protokoll.abschnitt3.umland.feld.auwald' },
    { pfad: 'umland.wiese', labelKey: 'protokoll.abschnitt3.umland.feld.wiese' },
    {
      pfad: 'umland.kulturland_acker',
      labelKey: 'protokoll.abschnitt3.umland.feld.kulturlandAcker',
    },
    {
      pfad: 'umland.feuchtgebiet_moor',
      labelKey: 'protokoll.abschnitt3.umland.feld.feuchtgebietMoor',
    },
    {
      pfad: 'umland.siedlungsgebiet',
      labelKey: 'protokoll.abschnitt3.umland.feld.siedlungsgebiet',
    },
  ],
}

/* How steep the bank is, as four shares of its length. The degree ranges are
   part of the question, not decoration, so they stay in the labels. */
export const UFERNEIGUNG: Prozentgruppe = {
  id: 'summe.neigung',
  legendKey: 'protokoll.abschnitt3.ufer.neigung.legend',
  felder: [
    { pfad: 'ufer.flachufer', labelKey: 'protokoll.abschnitt3.ufer.feld.flachufer' },
    { pfad: 'ufer.schraegufer', labelKey: 'protokoll.abschnitt3.ufer.feld.schraegufer' },
    { pfad: 'ufer.abbruch', labelKey: 'protokoll.abschnitt3.ufer.feld.abbruch' },
    {
      pfad: 'ufer.unterspuelung',
      labelKey: 'protokoll.abschnitt3.ufer.feld.unterspuelung',
    },
  ],
}

/* What grows on the bank above the waterline, as nine shares. The last is the
   open one, and ufer.sonstiger_bewuchs_text records what it was. */
export const UFERBEWUCHS: Prozentgruppe = {
  id: 'summe.bewuchs',
  legendKey: 'protokoll.abschnitt3.ufer.bewuchs.legend',
  felder: [
    { pfad: 'ufer.ohne_bewuchs', labelKey: 'protokoll.abschnitt3.ufer.feld.ohneBewuchs' },
    { pfad: 'ufer.graeser', labelKey: 'protokoll.abschnitt3.ufer.feld.graeser' },
    { pfad: 'ufer.schilf_rohr', labelKey: 'protokoll.abschnitt3.ufer.feld.schilfRohr' },
    {
      pfad: 'ufer.krautige_blattpflanzen',
      labelKey: 'protokoll.abschnitt3.ufer.feld.krautigeBlattpflanzen',
    },
    { pfad: 'ufer.straeucher', labelKey: 'protokoll.abschnitt3.ufer.feld.straeucher' },
    { pfad: 'ufer.weiden', labelKey: 'protokoll.abschnitt3.ufer.feld.weiden' },
    { pfad: 'ufer.erlen', labelKey: 'protokoll.abschnitt3.ufer.feld.erlen' },
    { pfad: 'ufer.andere_baeume', labelKey: 'protokoll.abschnitt3.ufer.feld.andereBaeume' },
    {
      pfad: 'ufer.sonstiger_bewuchs',
      labelKey: 'protokoll.abschnitt3.ufer.feld.sonstigerBewuchs',
    },
  ],
}

/* How the bank has been built up, as eight shares. Drahtnetze here is the
   bank's; the bed has its own under SOHLVERBAUUNG. */
export const UFERVERBAUUNG: Prozentgruppe = {
  id: 'summe.uferverbau',
  legendKey: 'protokoll.abschnitt3.ufer.uferverbauung.legend',
  felder: [
    {
      pfad: 'ufer.uferverbau_keiner',
      labelKey: 'protokoll.abschnitt3.ufer.feld.uferverbauKeiner',
    },
    {
      pfad: 'ufer.mauer_unverfugt',
      labelKey: 'protokoll.abschnitt3.ufer.feld.mauerUnverfugt',
    },
    { pfad: 'ufer.faschinen', labelKey: 'protokoll.abschnitt3.ufer.feld.faschinen' },
    { pfad: 'ufer.drahtnetze', labelKey: 'protokoll.abschnitt3.ufer.feld.drahtnetze' },
    { pfad: 'ufer.ueberwachsen', labelKey: 'protokoll.abschnitt3.ufer.feld.ueberwachsen' },
    { pfad: 'ufer.mauer_verfugt', labelKey: 'protokoll.abschnitt3.ufer.feld.mauerVerfugt' },
    { pfad: 'ufer.steinwurf', labelKey: 'protokoll.abschnitt3.ufer.feld.steinwurf' },
    {
      pfad: 'ufer.sonstiger_uferverbau',
      labelKey: 'protokoll.abschnitt3.ufer.feld.sonstigerUferverbau',
    },
  ],
}

/* What the bed is made of, as eight shares. The grain sizes are the question:
   "Kies" without ">2 mm" is asking something else.

   The group defect 1 is about. See regeln/prozent.ts. */
export const SUBSTRAT: Prozentgruppe = {
  id: 'summe.substrat',
  legendKey: 'protokoll.abschnitt3.gewaessersohle.substrat.legend',
  felder: [
    {
      pfad: 'gewaessersohle.schlamm',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.schlamm',
    },
    { pfad: 'gewaessersohle.lehm', labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.lehm' },
    {
      pfad: 'gewaessersohle.sonstiges_erdreich',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.sonstigesErdreich',
    },
    { pfad: 'gewaessersohle.sand', labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.sand' },
    { pfad: 'gewaessersohle.kies', labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.kies' },
    {
      pfad: 'gewaessersohle.grobkies',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.grobkies',
    },
    {
      pfad: 'gewaessersohle.steine',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.steine',
    },
    {
      pfad: 'gewaessersohle.felsen',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.felsen',
    },
  ],
}

/* How the bed has been built up, as six shares. */
export const SOHLVERBAUUNG: Prozentgruppe = {
  id: 'summe.sohlverbau',
  legendKey: 'protokoll.abschnitt3.gewaessersohle.sohlverbauung.legend',
  felder: [
    {
      pfad: 'gewaessersohle.keine_sohlverbauung',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.keineSohlverbauung',
    },
    {
      pfad: 'gewaessersohle.rasensteine',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.rasensteine',
    },
    {
      pfad: 'gewaessersohle.drahtnetze_sohlverbauung',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.drahtnetzeSohlverbauung',
    },
    {
      pfad: 'gewaessersohle.steinschuettung',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.steinschuettung',
    },
    {
      pfad: 'gewaessersohle.pflasterung',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.pflasterung',
    },
    {
      pfad: 'gewaessersohle.betonschale',
      labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.betonschale',
    },
  ],
}

/* Every Prozentgruppe of part 3, in the order the section renders them.
 *
 * The list regeln/prozent.ts sums over, and what gruppen.test.ts counts. Six of
 * them, which is what the build plan means by "the six percentage blocks": both
 * ufer and gewaessersohle carry more than one. */
export const PROZENTGRUPPEN: readonly Prozentgruppe[] = [
  UMLAND,
  UFERNEIGUNG,
  UFERBEWUCHS,
  UFERVERBAUUNG,
  SUBSTRAT,
  SOHLVERBAUUNG,
]
