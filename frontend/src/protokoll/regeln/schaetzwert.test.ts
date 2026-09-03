import { describe, expect, it } from 'vitest'
import { BAENDER, pruefeSchaetzwerte } from './schaetzwert'
import { optionen } from '../optionen'
import type { Antworten } from '../entwurf/typen'

function breite(band?: string, schaetzwert?: string): Antworten {
  return { hydrologie: { breite: band, breite_schaetzwert: schaetzwert } }
}

function tiefe(band?: string, schaetzwert?: string): Antworten {
  return { hydrologie: { tiefe: band, tiefe_schaetzwert: schaetzwert } }
}

function schluessel(antworten: Antworten) {
  return pruefeSchaetzwerte(antworten).map((verstoss) => verstoss.schluessel)
}

const AUSSERHALB = 'protokoll.regeln.schaetzwertAusserhalbBand'
const OHNE_BAND = 'protokoll.regeln.schaetzwertOhneBand'
const KEINE_ZAHL = 'protokoll.regeln.schaetzwertKeineZahl'

/* The bands are transcribed from the two field scripts in the legacy PDF, and
   the option lists are extracted from the same PDF by
   backend/scripts/extract_form_definition.py. If the two ever disagree, one
   band is unreachable and one option can never be checked, so this is a failing
   test rather than a silent gap. The extraction script guards the same join
   from the other side, in radio_options. */
describe('the band tables and the option lists agree', () => {
  it.each(['breite', 'tiefe'] as const)('for %s', (feld) => {
    const angeboten = optionen(`hydrologie.${feld}`).map(({ wert }) => wert)

    expect(Object.keys(BAENDER[feld]).sort()).toEqual(angeboten.sort())
  })
})

describe('pruefeSchaetzwerte', () => {
  it('says nothing about an untouched block', () => {
    expect(pruefeSchaetzwerte({})).toEqual([])
    expect(pruefeSchaetzwerte(breite())).toEqual([])
    expect(pruefeSchaetzwerte(breite('3'))).toEqual([])
  })

  /* A draft is half-finished by definition. Whether an estimate is required at
     all is feature 11's gate, exactly as for the coordinates in 4c. */
  it('says nothing about an estimate that was cleared', () => {
    expect(pruefeSchaetzwerte(breite('3', ''))).toEqual([])
    expect(pruefeSchaetzwerte(breite('3', '   '))).toEqual([])
  })

  it('wants the band chosen before the estimate is judged', () => {
    expect(schluessel(breite(undefined, '4'))).toEqual([OHNE_BAND])
    expect(schluessel(tiefe('', '0,4'))).toEqual([OHNE_BAND])
  })

  it('reports the estimate, which is the field being typed in', () => {
    expect(pruefeSchaetzwerte(breite('2', '95'))).toEqual([
      { pfad: 'hydrologie.breite_schaetzwert', schluessel: AUSSERHALB },
    ])
  })

  it('checks both estimates independently', () => {
    const beide: Antworten = {
      hydrologie: {
        breite: '2',
        breite_schaetzwert: '95',
        tiefe: '2',
        tiefe_schaetzwert: '0,2',
      },
    }

    expect(schluessel(beide)).toEqual([AUSSERHALB])
  })

  describe('reading the number', () => {
    /* The legacy form formats both estimates with a comma as the decimal
       separator, which is also what a German keyboard produces. A number input
       hands over a full stop, so both have to be readable. */
    it.each(['1,5', '1.5'])('accepts %s', (eingabe) => {
      expect(pruefeSchaetzwerte(breite('2', eingabe))).toEqual([])
    })

    /* Rejected rather than guessed at. Number("2 m") is NaN and Number("") is
       0, so a parse that trusted the browser would either compare against NaN
       or read an empty field as a real zero. */
    it.each(['ungefähr 2', '1,5,5', '2 m', '1e3', '1 000'])(
      'says %s is not a number',
      (eingabe) => {
        expect(schluessel(breite('2', eingabe))).toEqual([KEINE_ZAHL])
      },
    )

    it('treats a negative estimate as outside the band, not as a typo', () => {
      expect(schluessel(breite('2', '-1'))).toEqual([AUSSERHALB])
    })
  })

  /* Every boundary of every band, from both sides. schaetzwert.ts says why they
     are read the way they are. */
  describe('the Breite bands, in metres', () => {
    it.each([
      ['1', '0', true],
      ['1', '0,9', true],
      ['1', '1', false],
      ['2', '1', true],
      ['2', '1,9', true],
      ['2', '0,9', false],
      ['2', '2', false],
      ['3', '2', true],
      ['3', '4,9', true],
      ['3', '5', false],
      ['4', '14,9', true],
      ['4', '15', false],
      ['5', '15', true],
      ['5', '49,9', true],
      ['5', '50', false],
      ['6', '99,9', true],
      ['6', '100', false],
      ['7', '100', true],
      ['7', '2500', true],
      ['7', '99,9', false],
    ] as const)('band %s with %s', (band, wert, gueltig) => {
      expect(schluessel(breite(band, wert))).toEqual(gueltig ? [] : [AUSSERHALB])
    })
  })

  describe('the Tiefe bands, in metres', () => {
    it.each([
      ['1', '0', true],
      ['1', '0,09', true],
      ['1', '0,1', false],
      ['2', '0,1', true],
      ['2', '0,29', true],
      ['2', '0,3', false],
      ['3', '0,49', true],
      ['3', '0,5', false],
      ['4', '0,5', true],
      ['4', '1', false],
      ['5', '1,9', true],
      ['5', '2', false],
      ['6', '3,9', true],
      ['6', '4', false],
      ['7', '4', true],
      ['7', '300', true],
      ['7', '3,9', false],
    ] as const)('band %s with %s', (band, wert, gueltig) => {
      expect(schluessel(tiefe(band, wert))).toEqual(gueltig ? [] : [AUSSERHALB])
    })
  })

  /* On a standing water the whole section is marked as not applying, bands and
     estimates alike, by regeln/hydrologie.ts. The two have to agree: the block
     is off screen in that state, so this only ever catches a draft that was
     edited by hand or written by an older version. */
  describe('once the section has been marked as not applying', () => {
    it('accepts the estimate carrying the same marking', () => {
      expect(pruefeSchaetzwerte(breite('0', '0'))).toEqual([])
      expect(pruefeSchaetzwerte(tiefe('0', '0'))).toEqual([])
    })

    it('rejects a real estimate left behind under it', () => {
      expect(schluessel(breite('0', '95'))).toEqual([AUSSERHALB])
      expect(schluessel(tiefe('0', '1,5'))).toEqual([AUSSERHALB])
    })
  })
})
