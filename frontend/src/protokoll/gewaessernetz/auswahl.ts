/* What picking a water from the search writes into the draft, and when typing
 * takes it back.
 *
 * Plain functions, so the rule "the identifier belongs to the name it came with"
 * is tested without a browser. The backend holds the same rule at submit, in
 * backend/app/gewaessernetz/kennung.py; this side only keeps a draft from
 * carrying an identifier that the submit would refuse.
 */

import type { AntwortPfad } from '../entwurf/typen'
import type { Gewaessertreffer } from './api'

export const NAME_PFAD = 'probestrecke.gewaesser.gewaessername' satisfies AntwortPfad
export const KENNUNG_PFAD = 'probestrecke.gewaesser.amtliche_id' satisfies AntwortPfad
export const VERSION_PFAD = 'probestrecke.gewaesser.gis_dataset_version' satisfies AntwortPfad

/* The form backend/app/gewaessernetz/kennung.py reads back. The dataset's name
   travels with the release, so a different dataset later is told apart. */
export function datensatzversion(stand: string): string {
  return `AWGN ${stand}`
}

export type Eintraege = ReadonlyArray<readonly [AntwortPfad, string]>

/** The answers a pick writes, in the order they are written. */
export function wahlSchreibt(treffer: Gewaessertreffer, stand: string): Eintraege {
  return [
    [NAME_PFAD, treffer.name],
    [KENNUNG_PFAD, treffer.kennung],
    [VERSION_PFAD, datensatzversion(stand)],
  ]
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
