/* Where on the water each boundary point lies, as the backend answers it, and
 * what that writes into the draft.
 *
 * Mirrors EinrastenAntwort in backend/app/api/schemas.py. The server works the
 * same answers out again at submit (backend/app/gewaessernetz/einrasten.py), so
 * what the browser writes here only keeps the draft showing what the surveyor
 * saw. The typed coordinates are never touched by it.
 */

import { queryOptions } from '@tanstack/react-query'
import { apiAnfrage } from '../../api/client'
import type { AntwortPfad } from '../entwurf/typen'
import type { Netzart, Punkt } from '../gewaessernetz/api'
import { datensatzversion, type Eintraege } from '../gewaessernetz/auswahl'
import { abstandM, istFern } from '../regeln/abstand'
import type { Grenze } from './Grenzwahl'
import { gueltigerPunkt } from './umrechnung'

export interface Einrastung {
  kennung: string
  art: Netzart
  name: string
  rw: number
  hw: number
  entfernung_m: number
}

export interface EinrastenAntwort {
  /** The release snapped against, or null when it is not loaded. */
  stand: string | null
  /** Null when nothing is loaded or the picked water is not in its release. */
  treffer: Einrastung | null
}

/** A water picked from the search, as 18c stores it. */
export interface Gewaehlt {
  kennung: string
  name: string
  version: string
}

interface Angabe {
  pfad: AntwortPfad
  labelKey: string
}

export interface EinrastPfade {
  rw: Angabe
  hw: Angabe
  kennung: Angabe
  name: Angabe
}

export const GRENZEN = ['unten', 'oben'] as const satisfies readonly Grenze[]

/* Each answer with the label the PDF download prints it under. Declared as
   data, pfad beside labelKey, because that is how npm run beschriftungen finds
   a label; the screen shows these answers as a sentence instead. */
export const EINGERASTET: Readonly<Record<Grenze, EinrastPfade>> = {
  unten: {
    rw: {
      pfad: 'probestrecke.eingerastet_rw_unten',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetRwUnten',
    },
    hw: {
      pfad: 'probestrecke.eingerastet_hw_unten',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetHwUnten',
    },
    kennung: {
      pfad: 'probestrecke.eingerastet_kennung_unten',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetKennungUnten',
    },
    name: {
      pfad: 'probestrecke.eingerastet_name_unten',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetNameUnten',
    },
  },
  oben: {
    rw: {
      pfad: 'probestrecke.eingerastet_rw_oben',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetRwOben',
    },
    hw: {
      pfad: 'probestrecke.eingerastet_hw_oben',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetHwOben',
    },
    kennung: {
      pfad: 'probestrecke.eingerastet_kennung_oben',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetKennungOben',
    },
    name: {
      pfad: 'probestrecke.eingerastet_name_oben',
      labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetNameOben',
    },
  },
}
export const EINGERASTET_VERSION = {
  pfad: 'probestrecke.eingerastet_version',
  labelKey: 'protokoll.abschnitt1.probestrecke.feld.eingerastetVersion',
} as const satisfies Angabe
/* Declared here rather than written out on the FeldText, so the PDF prints it
   after the positions it explains: the label script reads files in order. */
export const BEGRUENDUNG = {
  pfad: 'probestrecke.abstand_begruendung',
  labelKey: 'protokoll.abschnitt1.probestrecke.feld.abstandBegruendung',
} as const satisfies Angabe

export function einrastpfad(punkt: Punkt, gewaehlt: Gewaehlt | null): string {
  const parameter = new URLSearchParams({ rw: String(punkt[0]), hw: String(punkt[1]) })
  if (gewaehlt) {
    parameter.set('kennung', gewaehlt.kennung)
    parameter.set('name', gewaehlt.name)
    parameter.set('version', gewaehlt.version)
  }
  return `/gewaessernetz/einrasten?${parameter.toString()}`
}

/* Nothing is asked for a point the coordinate rule does not accept: the caller
   passes null for one, and the point's answers are emptied instead. */
export function einrastenAbfrage(punkt: Punkt | null, gewaehlt: Gewaehlt | null) {
  const pfad = punkt ? einrastpfad(punkt, gewaehlt) : null
  return queryOptions({
    queryKey: ['gewaessernetz', pfad] as const,
    queryFn: () => apiAnfrage<EinrastenAntwort>(pfad!),
    enabled: pfad !== null,
    // The network changes a few times a year, as with the search.
    staleTime: Infinity,
    /* A failed request leaves the map as it was before 18d, which is a fine way
       to carry on; retrying would only hold it up. */
    retry: false,
  })
}

/* The picked water, when all three answers 18c writes are there. */
export function gewaehltAus(
  kennung: string | undefined,
  name: string | undefined,
  version: string | undefined,
): Gewaehlt | null {
  if (!kennung?.trim() || !name?.trim() || !version?.trim()) return null
  return { kennung, name, version }
}

/* What is known about one point: no valid point ('leer'), an answer, or
   nothing yet (undefined), while the request runs or after it failed. */
export type Punktstand = EinrastenAntwort | 'leer' | undefined

/* The answers the two points' states write. A point still unknown writes
   nothing, and so does the release while it could still change. */
export function einrastenSchreibt(staende: Readonly<Record<Grenze, Punktstand>>): Eintraege {
  const eintraege: Array<readonly [AntwortPfad, string]> = []
  let stand: string | null = null

  for (const grenze of GRENZEN) {
    const zustand = staende[grenze]
    if (zustand === undefined) continue
    const pfade = EINGERASTET[grenze]
    const treffer = zustand === 'leer' ? null : zustand.treffer
    eintraege.push(
      [pfade.rw.pfad, treffer ? String(treffer.rw) : ''],
      [pfade.hw.pfad, treffer ? String(treffer.hw) : ''],
      [pfade.kennung.pfad, treffer?.kennung ?? ''],
      [pfade.name.pfad, treffer?.name ?? ''],
    )
    if (treffer && zustand !== 'leer' && zustand.stand) stand = zustand.stand
  }

  if (stand !== null) {
    eintraege.push([EINGERASTET_VERSION.pfad, datensatzversion(stand)])
  } else if (GRENZEN.every((grenze) => staende[grenze] !== undefined)) {
    eintraege.push([EINGERASTET_VERSION.pfad, ''])
  }
  return eintraege
}

/* Only what differs from the draft, so opening a draft whose answers are
   already current does not mark it as changed. */
export function nurGeaenderte(
  eintraege: Eintraege,
  aktuell: (pfad: AntwortPfad) => string | undefined,
): Eintraege {
  return eintraege.filter(([pfad, wert]) => (aktuell(pfad) ?? '') !== wert)
}

/** What is known about one boundary point, as the answers and the request have it. */
export interface Punktangaben {
  rwGesetzt?: string
  hwGesetzt?: string
  rw?: string
  hw?: string
  name?: string
  /* Its request is still running or failed, so the stored position may belong
     to where the point was before it moved. */
  unsicher: boolean
}

export interface Lage {
  grenze: Grenze
  rw: string
  hw: string
  name: string
  abstand: number
}

/* The points that have a position on the water worth showing, with their
   distance. A point being asked about again is left out rather than measured
   against where it used to be. */
export function lagen(angaben: Readonly<Record<Grenze, Punktangaben>>): Lage[] {
  return GRENZEN.flatMap((grenze): Lage[] => {
    const { rwGesetzt, hwGesetzt, rw, hw, name, unsicher } = angaben[grenze]
    if (unsicher || !rw || !hw) return []
    const gesetzt = gueltigerPunkt(rwGesetzt, hwGesetzt)
    const amWasser = gueltigerPunkt(rw, hw)
    if (!gesetzt || !amWasser) return []
    return [{ grenze, rw, hw, name: name ?? '', abstand: abstandM(gesetzt, amWasser) }]
  })
}

export function ferne(alle: readonly Lage[]): Lage[] {
  return alle.filter((lage) => istFern(lage.abstand))
}

