import { istLeer } from './regel'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* Whether the Hydrologie block applies at all, and what the answers have to say
 * when it does not.
 *
 * A standing water has no current, no line and no flow velocity, so the legacy
 * form takes the whole section away for one. It marks the section as not
 * applying rather than merely emptying it: every hydrology radio group carries
 * an extra button exporting 0, parked in the right margin of the printed form
 * with no label beside it, and the standing water handlers set all of them to
 * that. Confirmed with FFS on 2026-09-02.
 *
 * Which types are standing is defect 9 in docs/ffs-defect-list.md. In the PDF
 * the button exporting 28 runs `if (gewaessertyp == 31)` and the one exporting
 * 29 runs `if (gewaessertyp == 32)`, and the field exports neither number, so
 * neither branch has ever run. Keyed to the values the field actually exports,
 * a connected oxbow keeps the section and a cut-off oxbow loses it, which is
 * what the printed form intends. */

/** What a hydrology answer holds when the section does not apply. */
export const HYDROLOGIE_NICHT_ZUTREFFEND = '0'

const STEHENDE_GEWAESSERTYPEN = [
  '21', // See
  '26', // Teich
  '29', // abgeschnittenes Altwasser
]

type Hydrologie = NonNullable<Antworten['hydrologie']>

/* The nine bands and the two estimates, in the order the legacy handlers set
   them, which is also the order the form prints them. */
const MARKIERTE_FELDER = [
  'breite',
  'breite_schaetzwert',
  'tiefe',
  'tiefe_schaetzwert',
  'tiefenvarianz',
  'linienfuehrung',
  'stroemung',
  'fliessgeschwindigkeit',
  'wasserfuehrung',
  'stillwasserbereich',
  'gesamtprofil',
] as const satisfies readonly (keyof Hydrologie)[]

/* The four qualifiers sitting inside a band group's row. There is no 0 for a
   checkbox, so not ticked is the whole of what they can say. */
const HAKEN_FELDER = [
  'mit_flachstellen',
  'mit_gumpen',
  'furkationen',
  'rueckstroemung',
] as const satisfies readonly (keyof Hydrologie)[]

function pfad(feld: keyof Hydrologie) {
  return `hydrologie.${feld}` as const
}

/** Every answer in the block, for rechecking the lot after a change. */
export const HYDROLOGIE_PFADE = [
  ...MARKIERTE_FELDER,
  ...HAKEN_FELDER,
].map(pfad) satisfies readonly AntwortPfad[]

/** One answer that has to change, and what it has to become. */
export interface Angleichung {
  pfad: AntwortPfad
  wert: string
}

/** Whether this Gewaessertyp takes the Hydrologie block away. */
export function istStehendesGewaesser(typ: string | undefined): boolean {
  return STEHENDE_GEWAESSERTYPEN.includes(typ ?? '')
}

/* What the Hydrologie answers have to change to for the chosen Gewaessertyp,
   and nothing when they already agree with it.
 *
 * Returning the writes rather than performing them keeps the rule testable
 * without a form, and returning none for a document that already agrees is what
 * stops the effect that applies them from rewriting what it just wrote. */
export function hydrologieAngleichen(antworten: Antworten): Angleichung[] {
  const typ = antworten.probestrecke?.gewaessertyp
  // Nothing chosen yet says nothing about the water, so nothing is written.
  if (istLeer(typ)) return []

  const stehend = istStehendesGewaesser(typ)
  const hydrologie = antworten.hydrologie
  const angleichungen: Angleichung[] = []

  /* Both directions. A standing water gets marked, and a water that stopped
     being standing has its marking taken off again: nothing offers 0 as an
     option, so a group left holding one would read as unanswered while the
     document said the section does not apply, on a water where it does. */
  for (const feld of MARKIERTE_FELDER) {
    const wert = hydrologie?.[feld]
    const markiert = wert === HYDROLOGIE_NICHT_ZUTREFFEND

    if (stehend && !markiert) {
      angleichungen.push({ pfad: pfad(feld), wert: HYDROLOGIE_NICHT_ZUTREFFEND })
    } else if (!stehend && markiert) {
      angleichungen.push({ pfad: pfad(feld), wert: '' })
    }
  }

  if (stehend) {
    for (const feld of HAKEN_FELDER) {
      if (istLeer(hydrologie?.[feld])) continue
      angleichungen.push({ pfad: pfad(feld), wert: '' })
    }
  }

  return angleichungen
}
