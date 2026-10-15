import grenzdatei from '@landesgrenze/landesgrenze_bw.json'

/* Whether a point lies in Baden-Wuerttemberg, widened by 2 km.

   The browser half of backend/app/protokolle/formregeln/landesgrenze.py, reading
   the same file, so the two cannot disagree about where the border is.
   backend/scripts/landesgrenze.py explains how the file was made and why it is
   wider than the state.

   Even-odd ray casting over every ring of every polygon, which gets holes and
   separate parts right without telling outer rings from holes. A point exactly
   on an edge counts as inside, tested first, because ray casting on its own
   answers an edge either way depending on which edge it is. */

type Ring = number[][]

export interface Landesgrenze {
  /* Each polygon is its outer ring followed by its holes, in EPSG:25832 metres. */
  polygone: Ring[][]
}

export const LANDESGRENZE: Landesgrenze = { polygone: grenzdatei.polygone }

/* What the coordinate message says the margin is. */
export const RAND_KM = grenzdatei.verbreiterung_m / 1000

export function liegtImLand(grenze: Landesgrenze, rw: number, hw: number): boolean {
  let drin = false
  for (const polygon of grenze.polygone) {
    for (const ring of polygon) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[i + 1]
        if (aufStrecke(rw, hw, x1, y1, x2, y2)) return true
        // Does a ray from the point towards the east cross this edge? The
        // half-open comparison counts a vertex the ray passes through once.
        if (y1 > hw !== y2 > hw && rw < x1 + ((hw - y1) * (x2 - x1)) / (y2 - y1)) {
          drin = !drin
        }
      }
    }
  }
  return drin
}

function aufStrecke(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  // Whole metres throughout, so the cross product is exact.
  if ((x2 - x1) * (py - y1) !== (y2 - y1) * (px - x1)) return false
  return (
    Math.min(x1, x2) <= px && px <= Math.max(x1, x2) && Math.min(y1, y2) <= py && py <= Math.max(y1, y2)
  )
}
