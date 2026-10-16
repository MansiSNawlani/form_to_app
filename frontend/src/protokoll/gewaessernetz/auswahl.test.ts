import { describe, expect, it } from 'vitest'
import { suchpfad, type Gewaessertreffer } from './api'
import {
  KENNUNG_LEEREN,
  KENNUNG_PFAD,
  NAME_PFAD,
  VERSION_PFAD,
  datensatzversion,
  entfernungText,
  kennungBleibt,
  kettenHinweis,
  suchpunkte,
  unterzeile,
  wahlSchreibt,
} from './auswahl'

const MUEHLBACH: Gewaessertreffer = {
  kennung: '2384100000000',
  art: 'FLIESSGEWAESSER',
  name: 'Mühlbach',
  vorfluter_name: 'Enz',
  vorfluter: ['Enz', 'Neckar', 'Rhein'],
  entfernung_m: 640,
}

const KETTE = [1, 2, 3, 4, 5].map((n) => `probestrecke.gewaesser.vorfluter${n}`)

describe('wahlSchreibt', () => {
  it('schreibt Name, Kennung, Stand und die passende Kette, leert den Rest', () => {
    expect(wahlSchreibt(MUEHLBACH, '2025-05-01')).toEqual([
      [NAME_PFAD, 'Mühlbach'],
      [KENNUNG_PFAD, '2384100000000'],
      [VERSION_PFAD, 'AWGN 2025-05-01'],
      [KETTE[0], 'Enz'],
      [KETTE[1], 'Neckar'],
      [KETTE[2], 'Rhein'],
      [KETTE[3], ''],
      [KETTE[4], ''],
    ])
  })

  it('laesst die Vorfluter stehen, wenn die Kette nicht passt', () => {
    const lang = { ...MUEHLBACH, vorfluter: null }
    expect(wahlSchreibt(lang, '2025-05-01').map(([pfad]) => pfad)).toEqual([
      NAME_PFAD,
      KENNUNG_PFAD,
      VERSION_PFAD,
    ])
  })
})

describe('kettenHinweis', () => {
  it('nichts, wenn die Kette eingetragen wird', () => {
    expect(kettenHinweis(MUEHLBACH)).toBeNull()
  })

  it('zu lang bei einem Fliessgewaesser ohne passende Kette', () => {
    expect(kettenHinweis({ ...MUEHLBACH, vorfluter: null })).toBe('zuLang')
  })

  /* The Rhein and the Donau are where every chain ends, so they have none
     themselves. Nothing to fill and nothing wrong, so no note. */
  it('nichts beim Rhein, der selbst das Ende jeder Kette ist', () => {
    expect(kettenHinweis(RHEIN)).toBeNull()
  })

  it('stehend bei einem stehenden Gewaesser', () => {
    expect(
      kettenHinweis({ ...MUEHLBACH, art: 'STEHENDES_GEWAESSER', vorfluter: null, vorfluter_name: null }),
    ).toBe('stehend')
  })
})

describe('entfernungText', () => {
  it.each([
    [0, 'de', '0 m'],
    [640, 'de', '640 m'],
    [999, 'de', '999 m'],
    [1000, 'de', '1 km'],
    [12345, 'de', '12,3 km'],
    [12345, 'en', '12.3 km'],
  ] as const)('%d m auf %s', (meter, sprache, erwartet) => {
    expect(entfernungText(meter, sprache)).toBe(erwartet)
  })
})

describe('suchpunkte', () => {
  it('nimmt nur Punkte, die die Koordinatenregel annimmt', () => {
    expect(
      suchpunkte({
        utm_rw_unten: '513224',
        utm_hw_unten: '5402838',
        utm_rw_oben: '700000',
        utm_hw_oben: '5402838',
      }),
    ).toEqual([[513224, 5402838]])
  })

  it('nichts ohne Koordinaten', () => {
    expect(suchpunkte(undefined)).toEqual([])
  })
})

describe('datensatzversion', () => {
  it('hat die Form, die das Backend liest', () => {
    expect(datensatzversion('2025-05-01')).toBe('AWGN 2025-05-01')
  })
})

describe('KENNUNG_LEEREN', () => {
  it('leert Kennung und Stand, nicht den Namen', () => {
    expect(KENNUNG_LEEREN).toEqual([
      [KENNUNG_PFAD, ''],
      [VERSION_PFAD, ''],
    ])
  })
})

describe('kennungBleibt', () => {
  it('solange genau der gewaehlte Name im Feld steht', () => {
    expect(kennungBleibt('Mühlbach', 'Mühlbach')).toBe(true)
  })

  it.each(['Mühlbac', 'Mühlbach ', 'MÜHLBACH', ''])('nicht bei %j', (eingabe) => {
    expect(kennungBleibt(eingabe, 'Mühlbach')).toBe(false)
  })

  it('nicht ohne Wahl', () => {
    expect(kennungBleibt('Mühlbach', undefined)).toBe(false)
  })
})

describe('suchpfad', () => {
  it('schickt die Eingabe ohne Leerzeichen am Rand', () => {
    expect(suchpfad('  Mühlb ')).toBe('/gewaessernetz/suche?q=M%C3%BChlb')
  })

  it('schickt Punkte paarweise', () => {
    expect(
      suchpfad('Mühlb', [
        [478000, 5420000],
        [478400, 5421000],
      ]),
    ).toBe('/gewaessernetz/suche?q=M%C3%BChlb&rw=478000&hw=5420000&rw=478400&hw=5421000')
  })
})

const RHEIN: Gewaessertreffer = {
  kennung: '2000000000000',
  art: 'FLIESSGEWAESSER',
  name: 'Rhein',
  vorfluter_name: null,
  vorfluter: null,
  entfernung_m: null,
}

describe('unterzeile', () => {
  it('ein Fliessgewaesser nennt, wohin es fliesst', () => {
    expect(unterzeile(MUEHLBACH)).toEqual({ art: 'fliesstIn', name: 'Enz' })
  })

  it('ein stehendes Gewaesser sagt das, nach seiner Art und nicht nach dem Vorfluter', () => {
    expect(
      unterzeile({ ...MUEHLBACH, art: 'STEHENDES_GEWAESSER', vorfluter: null, vorfluter_name: null }),
    ).toEqual({ art: 'stehend' })
  })

  it('der Rhein ist ein Fliessgewaesser, das nirgends hinfliesst', () => {
    expect(unterzeile(RHEIN)).toEqual({ art: 'endpunkt' })
  })
})
