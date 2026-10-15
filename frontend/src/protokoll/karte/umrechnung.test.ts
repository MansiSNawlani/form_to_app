import { describe, expect, it } from 'vitest'
import { BW_GRENZEN } from '../regeln/koordinaten'
import { zuKartenpunkt, zuUtm } from './umrechnung'

/* Reference values from pyproj 3.8.0 (PROJ), computed independently of proj4
   on 2026-10-14. A conversion checked only against itself would pass while
   putting every point 300 m off, which on a map still looks plausible.

   lng and lat go to EPSG:25832 as rw and hw. The whole-metre pair the form
   would hold then goes back as zurueck, separately, because rounding to the
   metre moves the point by up to half a metre. */
const REFERENZ = [
  {
    name: 'central meridian',
    lng: 9.0, lat: 48.0, rw: 500000.0, hw: 5316300.224,
    zurueck: { lng: 9.0, lat: 47.99999798 },
  },
  {
    name: 'Stuttgart',
    lng: 9.18, lat: 48.7784, rw: 513223.96, hw: 5402837.661,
    zurueck: { lng: 9.18000056, lat: 48.77840305 },
  },
  {
    name: 'Freiburg',
    lng: 7.85, lat: 47.995, rw: 414207.476, hw: 5316384.321,
    zurueck: { lng: 7.84999369, lat: 47.99499705 },
  },
  {
    name: 'Tauberfranken',
    lng: 10.0, lat: 49.5, rw: 572407.01, hw: 5483521.328,
    zurueck: { lng: 9.9999998, lat: 49.49999705 },
  },
]

describe('zuUtm', () => {
  it.each(REFERENZ)('matches PROJ for $name, to the metre', ({ lng, lat, rw, hw }) => {
    expect(zuUtm({ lng, lat })).toEqual({
      rechtswert: String(Math.round(rw)),
      hochwert: String(Math.round(hw)),
    })
  })

  it('puts 9 degrees east exactly on the false easting', () => {
    expect(zuUtm({ lng: 9, lat: 48.5 }).rechtswert).toBe('500000')
  })
})

describe('zuKartenpunkt', () => {
  it.each(REFERENZ)('matches PROJ for $name', ({ rw, hw, zurueck }) => {
    const punkt = zuKartenpunkt(String(Math.round(rw)), String(Math.round(hw)))
    // Seven places is about a centimetre.
    expect(punkt?.lng).toBeCloseTo(zurueck.lng, 7)
    expect(punkt?.lat).toBeCloseTo(zurueck.lat, 7)
  })

  it('comes back to the same whole metres', () => {
    const punkt = zuKartenpunkt('512345', '5385432')
    expect(punkt).not.toBeNull()
    expect(zuUtm(punkt!)).toEqual({ rechtswert: '512345', hochwert: '5385432' })
  })

  it('ignores the spaces around a typed value', () => {
    expect(zuKartenpunkt(' 512000 ', '5385000')).not.toBeNull()
  })

  it('gives a point on the far bank of the Rhein at Kehl', () => {
    expect(zuKartenpunkt('411403', '5380353')).not.toBeNull()
  })

  it.each([
    ['an empty box', '', '5385000'],
    ['a blank box', '  ', '5385000'],
    ['a missing value', undefined, '5385000'],
    ['the other value missing', '512000', undefined],
    ['a decimal', '512000.5', '5385000'],
    ['a value that is not a number', 'abc', '5385000'],
    ['an exponent', '5.12e5', '5385000'],
    ['a Rechtswert below the bounds', String(BW_GRENZEN.rechtswert.min - 1), '5385000'],
    ['a Hochwert above the bounds', '512000', String(BW_GRENZEN.hochwert.max + 1)],
    ['a swapped pair', '5385000', '512000'],
    ['a point in Wuerzburg, inside the rectangle but outside the state', '566895', '5515841'],
  ])('gives no point for %s', (_fall, rechtswert, hochwert) => {
    expect(zuKartenpunkt(rechtswert, hochwert)).toBeNull()
  })
})
