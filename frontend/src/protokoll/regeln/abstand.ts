import type { Punkt } from '../gewaessernetz/api'

/* How far a boundary point may lie from its water before it is warned about.

   The Python half is backend/app/gewaessernetz/einrasten.py, which asks for a
   reason at submit beyond the same distance. Here rather than beside the map
   code because the interface's wording reads it too (i18n/index.ts), and that
   should not pull the map's request code in with it. */
export const WARNABSTAND_M = 100

/* Whole metres between a typed point and its position on the water, as the
   server works it out in abstand_m. */
export function abstandM(punkt: Punkt, eingerastet: Punkt): number {
  return Math.round(Math.hypot(eingerastet[0] - punkt[0], eingerastet[1] - punkt[1]))
}

export function istFern(abstand: number): boolean {
  return abstand > WARNABSTAND_M
}
