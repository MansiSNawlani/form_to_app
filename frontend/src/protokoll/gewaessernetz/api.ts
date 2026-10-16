/* The search over LUBW's water body network, as the backend answers it.
 *
 * Mirrors GewaessersucheAntwort in backend/app/api/schemas.py. What each value
 * promises is written down beside Treffer in backend/app/gewaessernetz/suche.py.
 */

import { queryOptions } from '@tanstack/react-query'
import { apiAnfrage } from '../../api/client'

export type Netzart = 'FLIESSGEWAESSER' | 'STEHENDES_GEWAESSER'

export interface Gewaessertreffer {
  kennung: string
  art: Netzart
  name: string
  vorfluter_name: string | null
  /** The chain for the five boxes, or null when it does not fit them. */
  vorfluter: string[] | null
  entfernung_m: number | null
}

export interface Gewaessersuche {
  /** The release searched, as YYYY-MM-DD, or null when none is loaded. */
  stand: string | null
  treffer: Gewaessertreffer[]
}

/** A boundary point in EPSG:25832, Rechtswert then Hochwert. */
export type Punkt = readonly [number, number]

/** Typed text shorter than this is not sent; the backend refuses it too. */
export const MIN_ZEICHEN = 2

/** Whether the typed text is long enough to send. */
export function suchbar(eingabe: string): boolean {
  return eingabe.trim().length >= MIN_ZEICHEN
}

export function suchpfad(eingabe: string, punkte: readonly Punkt[] = []): string {
  const parameter = new URLSearchParams({ q: eingabe.trim() })
  for (const [rw, hw] of punkte) {
    parameter.append('rw', String(rw))
    parameter.append('hw', String(hw))
  }
  return `/gewaessernetz/suche?${parameter.toString()}`
}

/* aktiv is the caller's own condition on top of the text being long enough:
   the field asks only while its list is open. */
export function gewaessersucheAbfrage(
  eingabe: string,
  punkte: readonly Punkt[] = [],
  aktiv = true,
) {
  const pfad = suchpfad(eingabe, punkte)
  return queryOptions({
    queryKey: ['gewaessernetz', pfad] as const,
    queryFn: () => apiAnfrage<Gewaessersuche>(pfad),
    enabled: aktiv && suchbar(eingabe),
    /* The network changes when an administrator loads a release, a few times a
       year, so an answer is worth keeping for the whole visit. */
    staleTime: Infinity,
    /* A search that fails leaves a plain text box behind, which is a fine way
       to carry on; retrying would only hold up the hint saying so. */
    retry: false,
  })
}
