import { describe, expect, it } from 'vitest'
import { BW_GRENZEN, pruefeKoordinaten } from './koordinaten'
import type { Antworten } from '../entwurf/typen'

const GUELTIG = {
  utm_rw_unten: '512000',
  utm_hw_unten: '5385000',
  utm_rw_oben: '512400',
  utm_hw_oben: '5385300',
}

function mitKoordinaten(aenderung: Partial<typeof GUELTIG>): Antworten {
  return { probestrecke: { ...GUELTIG, ...aenderung } }
}

function pfade(antworten: Antworten) {
  return pruefeKoordinaten(antworten).map((verstoss) => verstoss.pfad)
}

function schluessel(antworten: Antworten) {
  return pruefeKoordinaten(antworten).map((verstoss) => verstoss.schluessel)
}

describe('pruefeKoordinaten', () => {
  it('accepts a stretch inside Baden-Wuerttemberg', () => {
    expect(pruefeKoordinaten(mitKoordinaten({}))).toEqual([])
  })

  it('says nothing about coordinates nobody has typed', () => {
    expect(pruefeKoordinaten({})).toEqual([])
    expect(pruefeKoordinaten({ probestrecke: {} })).toEqual([])
    expect(pruefeKoordinaten(mitKoordinaten({ utm_rw_unten: '' }))).toEqual([])
    expect(pruefeKoordinaten(mitKoordinaten({ utm_rw_unten: '  ' }))).toEqual([])
  })

  /* The corners of the rectangle lie outside the state, so the border check
     speaks up there. The rectangle itself must not. */
  it('does not reject a value on either bound of the rectangle', () => {
    const anDenGrenzen: Antworten = {
      probestrecke: {
        utm_rw_unten: String(BW_GRENZEN.rechtswert.min),
        utm_rw_oben: String(BW_GRENZEN.rechtswert.max),
        utm_hw_unten: String(BW_GRENZEN.hochwert.min),
        utm_hw_oben: String(BW_GRENZEN.hochwert.max),
      },
    }
    expect(new Set(schluessel(anDenGrenzen))).toEqual(
      new Set(['protokoll.regeln.koordinateAusserhalbLandes']),
    )
  })

  it('rejects a value below the minimum', () => {
    const zuWeitWestlich = String(BW_GRENZEN.rechtswert.min - 1)
    expect(schluessel(mitKoordinaten({ utm_rw_unten: zuWeitWestlich }))).toEqual([
      'protokoll.regeln.koordinateRechtswertAusserhalb',
    ])
  })

  it('rejects a value above the maximum', () => {
    const zuWeitNoerdlich = String(BW_GRENZEN.hochwert.max + 1)
    expect(schluessel(mitKoordinaten({ utm_hw_oben: zuWeitNoerdlich }))).toEqual([
      'protokoll.regeln.koordinateHochwertAusserhalb',
    ])
  })

  /* The mistake the check exists for: a Hochwert typed into the Rechtswert box
     is an order of magnitude too large and lands far outside the state. */
  it('catches a swapped Rechtswert and Hochwert', () => {
    const vertauscht = mitKoordinaten({
      utm_rw_unten: GUELTIG.utm_hw_unten,
      utm_hw_unten: GUELTIG.utm_rw_unten,
    })
    expect(pfade(vertauscht)).toEqual([
      'probestrecke.utm_rw_unten',
      'probestrecke.utm_hw_unten',
    ])
  })

  it('catches a dropped digit', () => {
    expect(pfade(mitKoordinaten({ utm_rw_oben: '51240' }))).toEqual([
      'probestrecke.utm_rw_oben',
    ])
  })

  /* Degrees rather than metres, or a Gauss-Krueger value from an older map.
     Both are far outside the box rather than subtly wrong. */
  it('catches degrees and Gauss-Krueger values', () => {
    expect(pfade(mitKoordinaten({ utm_rw_unten: '9' }))).toHaveLength(1)
    expect(pfade(mitKoordinaten({ utm_rw_unten: '3512000' }))).toHaveLength(1)
  })

  it.each(['abc', '512000,5', '512.000', '5,12e5'])(
    'rejects %s as not a whole number of metres',
    (wert) => {
      expect(schluessel(mitKoordinaten({ utm_rw_unten: wert }))).toEqual([
        'protokoll.regeln.koordinateKeineGanzeZahl',
      ])
    },
  )

  /* A negative is a whole number, so telling somebody to type a whole number
     would be no help. It is a coordinate in the wrong place. */
  it('treats a negative value as outside the state, not as unreadable', () => {
    expect(schluessel(mitKoordinaten({ utm_rw_unten: '-512000' }))).toEqual([
      'protokoll.regeln.koordinateRechtswertAusserhalb',
    ])
  })

  it('rejects a decimal even when it is inside the bounds', () => {
    expect(schluessel(mitKoordinaten({ utm_hw_unten: '5385000.4' }))).toEqual([
      'protokoll.regeln.koordinateKeineGanzeZahl',
    ])
  })

  it('checks all four boxes', () => {
    const alleFalsch = mitKoordinaten({
      utm_rw_unten: '1',
      utm_hw_unten: '1',
      utm_rw_oben: '1',
      utm_hw_oben: '1',
    })
    expect(pfade(alleFalsch)).toEqual([
      'probestrecke.utm_rw_unten',
      'probestrecke.utm_hw_unten',
      'probestrecke.utm_rw_oben',
      'probestrecke.utm_hw_oben',
    ])
  })

  /* Both inside the rectangle and outside the state, so only the border check
     can catch them. Munich and Colmar would not do: the rectangle already does. */
  describe('the border', () => {
    const WUERZBURG = { utm_rw_unten: '566895', utm_hw_unten: '5515841' }
    const STRASSBURG = { utm_rw_oben: '407876', utm_hw_oben: '5381721' }
    const AUSSERHALB = 'protokoll.regeln.koordinateAusserhalbLandes'

    it('rejects a point in Bavaria and names both its boxes', () => {
      expect(pruefeKoordinaten(mitKoordinaten(WUERZBURG))).toEqual([
        { pfad: 'probestrecke.utm_rw_unten', schluessel: AUSSERHALB },
        { pfad: 'probestrecke.utm_hw_unten', schluessel: AUSSERHALB },
      ])
    })

    it('checks both points', () => {
      expect(pfade(mitKoordinaten({ ...WUERZBURG, ...STRASSBURG }))).toEqual([
        'probestrecke.utm_rw_unten',
        'probestrecke.utm_hw_unten',
        'probestrecke.utm_rw_oben',
        'probestrecke.utm_hw_oben',
      ])
    })

    it('accepts the far bank of the Rhein at Kehl', () => {
      expect(
        pruefeKoordinaten(mitKoordinaten({ utm_rw_unten: '411403', utm_hw_unten: '5380353' })),
      ).toEqual([])
    })

    it('says nothing about a point with one box empty', () => {
      expect(pruefeKoordinaten({ probestrecke: { utm_rw_unten: '566895' } })).toEqual([])
    })

    /* The rectangle's message is the useful one; a second about the border
       would only repeat it. */
    it('says nothing more about a point whose box is already wrong', () => {
      const vertauscht = mitKoordinaten({ utm_rw_unten: '5385000', utm_hw_unten: '512000' })
      expect(schluessel(vertauscht)).not.toContain(AUSSERHALB)
    })
  })
})
