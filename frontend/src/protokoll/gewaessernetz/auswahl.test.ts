import { describe, expect, it } from 'vitest'
import { suchpfad, type Gewaessertreffer } from './api'
import {
  KENNUNG_LEEREN,
  KENNUNG_PFAD,
  NAME_PFAD,
  VERSION_PFAD,
  datensatzversion,
  kennungBleibt,
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

describe('wahlSchreibt', () => {
  it('schreibt Name, Kennung und Stand', () => {
    expect(wahlSchreibt(MUEHLBACH, '2025-05-01')).toEqual([
      [NAME_PFAD, 'Mühlbach'],
      [KENNUNG_PFAD, '2384100000000'],
      [VERSION_PFAD, 'AWGN 2025-05-01'],
    ])
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
