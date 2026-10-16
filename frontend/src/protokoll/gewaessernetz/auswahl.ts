/* What picking a water from the search writes into the draft, and when typing
 * takes it back.
 *
 * Plain functions, so the rule "the identifier belongs to the name it came with"
 * is tested without a browser. The backend holds the same rule at submit, in
 * backend/app/gewaessernetz/kennung.py; this side only keeps a draft from
 * carrying an identifier that the submit would refuse.
 */

import type { Locale } from '../../i18n/sprachen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'
import { gueltigerPunkt } from '../karte/umrechnung'
import { PUNKTE } from '../regeln/koordinaten'
import { VORFLUTER_PFADE } from '../regeln/vorfluter'
import type { Gewaessertreffer, Punkt } from './api'

export const NAME_PFAD = 'probestrecke.gewaesser.gewaessername' satisfies AntwortPfad
export const KENNUNG_PFAD = 'probestrecke.gewaesser.amtliche_id' satisfies AntwortPfad
export const VERSION_PFAD = 'probestrecke.gewaesser.gis_dataset_version' satisfies AntwortPfad

/* The form backend/app/gewaessernetz/kennung.py reads back. The dataset's name
   travels with the release, so a different dataset later is told apart. */
export function datensatzversion(stand: string): string {
  return `AWGN ${stand}`
}

export type Eintraege = ReadonlyArray<readonly [AntwortPfad, string]>

/* The answers a pick writes, in the order they are written.

   The Vorfluter chain only when it fits the five boxes, and then all five, the
   ones past its end emptied, so no link of a chain typed earlier is left hanging
   off the end of LUBW's. When it does not fit the boxes are left alone and
   kettenHinweis says why. */
export function wahlSchreibt(treffer: Gewaessertreffer, stand: string): Eintraege {
  const eintraege: Array<readonly [AntwortPfad, string]> = [
    [NAME_PFAD, treffer.name],
    [KENNUNG_PFAD, treffer.kennung],
    [VERSION_PFAD, datensatzversion(stand)],
  ]
  const kette = treffer.vorfluter
  if (kette !== null) {
    VORFLUTER_PFADE.forEach((pfad, index) => eintraege.push([pfad, kette[index] ?? '']))
  }
  return eintraege
}

export type KettenHinweis = 'zuLang' | 'stehend'

/** Why a pick left the Vorfluter boxes alone, or null when it filled them. */
export function kettenHinweis(treffer: Gewaessertreffer): KettenHinweis | null {
  if (treffer.vorfluter !== null) return null
  return treffer.art === 'STEHENDES_GEWAESSER' ? 'stehend' : 'zuLang'
}

/* Metres under a kilometre, kilometres with one decimal above, as the locale
   writes a number. Whole metres are more than the ranking needs, but a
   surveyor standing on the bank reads "640 m" faster than "0,6 km". */
export function entfernungText(meter: number, sprache: Locale): string {
  if (meter < 1000) return `${meter} m`
  const km = new Intl.NumberFormat(sprache, { maximumFractionDigits: 1 }).format(meter / 1000)
  return `${km} km`
}

/* The stretch's boundary points the search may rank by: only those the
   coordinate rule accepts, the same test the map uses before drawing a marker. */
export function suchpunkte(probestrecke: Antworten['probestrecke']): Punkt[] {
  const punkte: Punkt[] = []
  for (const [rw, hw] of PUNKTE) {
    const punkt = gueltigerPunkt(probestrecke?.[rw], probestrecke?.[hw])
    if (punkt !== null) punkte.push(punkt)
  }
  return punkte
}

/** What typing over a picked name writes: the identifier and release, emptied. */
export const KENNUNG_LEEREN: Eintraege = [
  [KENNUNG_PFAD, ''],
  [VERSION_PFAD, ''],
]

/* Whether the identifier still belongs to what is in the box. Exactly the
   picked spelling: the backend compares loosely, but a surveyor retyping the
   name in capitals has stopped using the list's entry, and keeping the
   identifier would be a claim the box no longer makes. */
export function kennungBleibt(eingabe: string, gewaehlterName: string | undefined): boolean {
  return gewaehlterName !== undefined && eingabe === gewaehlterName
}
