import { describe, expect, it } from 'vitest'
import { LANDESGRENZE, liegtImLand, type Landesgrenze } from './landesgrenze'

/* Ported case for case from
   backend/app/protokolle/formregeln/landesgrenze_test.py. */

const QUADRAT = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
const LOCH = [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]
const INSEL = [[200, 0], [250, 0], [250, 50], [200, 50], [200, 0]]
const BEISPIEL: Landesgrenze = { polygone: [[QUADRAT, LOCH], [INSEL]] }

describe('liegtImLand', () => {
  it.each([
    [10, 10, true],
    [50, 50, false], // in the hole
    [225, 25, true], // in the second part
    [150, 50, false], // between the two
    [-1, 50, false],
    [0, 50, true], // on an edge counts as inside
    [100, 100, true], // on a corner too
    [40, 50, true], // and on the edge of the hole
    [50, 0, true], // on a horizontal edge
  ])('(%i, %i) inside: %s', (rw, hw, drin) => {
    expect(liegtImLand(BEISPIEL, rw, hw)).toBe(drin)
  })
})

/* Against the committed file, so these name real places, projected from WGS84
   to EPSG:25832 with PostGIS on 2026-10-15. */
describe('the real border', () => {
  it.each([
    ['Stuttgart, Schlossplatz', 513224, 5402838],
    ['Kehl, French half of the Rhein, 1.7 km inside', 411403, 5380353],
    ['Bodensee, middle of the Obersee', 530074, 5270810],
    ['Bodensee, middle of the Untersee', 502252, 5280735],
    ['Neu-Ulm, 1.1 km inside', 574841, 5360476],
    ['Buesingen', 476740, 5282670],
    ['Wertheim am Main', 537215, 5511953],
  ])('%s is inside', (_ort, rw, hw) => {
    expect(liegtImLand(LANDESGRENZE, rw, hw)).toBe(true)
  })

  it.each([
    ['Strasbourg, cathedral, 1.6 km outside', 407876, 5381721],
    ['Colmar', 377741, 5326429],
    ['Munich', 691603, 5334780],
    ['Wuerzburg', 566895, 5515841],
    ['Frankfurt am Main', 477270, 5551010],
    ['Zurich', 465403, 5247151],
  ])('%s is outside', (_ort, rw, hw) => {
    expect(liegtImLand(LANDESGRENZE, rw, hw)).toBe(false)
  })
})
