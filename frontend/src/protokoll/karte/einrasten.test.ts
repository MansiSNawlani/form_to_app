import { describe, expect, it } from 'vitest'
import type { AntwortPfad } from '../entwurf/typen'
import {
  EINGERASTET_VERSION,
  einrastenAbfrage,
  einrastenSchreibt,
  einrastpfad,
  gewaehltAus,
  nurGeaenderte,
  type EinrastenAntwort,
} from './einrasten'

const ENZ: EinrastenAntwort = {
  stand: '2025-05-01',
  treffer: {
    kennung: '2384000000000',
    art: 'FLIESSGEWAESSER',
    name: 'Enz',
    rw: 478012,
    hw: 5420033,
    entfernung_m: 38,
  },
}

const LEER_UNTEN = [
  ['probestrecke.eingerastet_rw_unten', ''],
  ['probestrecke.eingerastet_hw_unten', ''],
  ['probestrecke.eingerastet_kennung_unten', ''],
  ['probestrecke.eingerastet_name_unten', ''],
]

describe('einrastpfad', () => {
  it('schickt den Punkt', () => {
    expect(einrastpfad([478000, 5420000], null)).toBe(
      '/gewaessernetz/einrasten?rw=478000&hw=5420000',
    )
  })

  it('schickt das gewählte Gewässer mit', () => {
    const pfad = einrastpfad([478000, 5420000], {
      kennung: '2384000000000',
      name: 'Enz',
      version: 'AWGN 2025-05-01',
    })
    expect(pfad).toBe(
      '/gewaessernetz/einrasten?rw=478000&hw=5420000&kennung=2384000000000&name=Enz&version=AWGN+2025-05-01',
    )
  })
})

describe('einrastenAbfrage', () => {
  it('fragt für einen ungültigen Punkt nicht', () => {
    expect(einrastenAbfrage(null, null).enabled).toBe(false)
  })

  it('fragt für einen gültigen Punkt', () => {
    expect(einrastenAbfrage([478000, 5420000], null).enabled).toBe(true)
  })
})

describe('gewaehltAus', () => {
  it('braucht alle drei Angaben', () => {
    expect(gewaehltAus('2384000000000', 'Enz', '')).toBeNull()
    expect(gewaehltAus(undefined, 'Enz', 'AWGN 2025-05-01')).toBeNull()
    expect(gewaehltAus('2384000000000', 'Enz', 'AWGN 2025-05-01')).toEqual({
      kennung: '2384000000000',
      name: 'Enz',
      version: 'AWGN 2025-05-01',
    })
  })
})

describe('einrastenSchreibt', () => {
  it('schreibt Lage, Kennung, Name und Stand eines Treffers', () => {
    expect(einrastenSchreibt({ unten: ENZ, oben: 'leer' })).toEqual([
      ['probestrecke.eingerastet_rw_unten', '478012'],
      ['probestrecke.eingerastet_hw_unten', '5420033'],
      ['probestrecke.eingerastet_kennung_unten', '2384000000000'],
      ['probestrecke.eingerastet_name_unten', 'Enz'],
      ['probestrecke.eingerastet_rw_oben', ''],
      ['probestrecke.eingerastet_hw_oben', ''],
      ['probestrecke.eingerastet_kennung_oben', ''],
      ['probestrecke.eingerastet_name_oben', ''],
      [EINGERASTET_VERSION.pfad, 'AWGN 2025-05-01'],
    ])
  })

  it('leert alles, wenn kein Punkt gültig ist', () => {
    const eintraege = einrastenSchreibt({ unten: 'leer', oben: 'leer' })
    expect(eintraege.every(([, wert]) => wert === '')).toBe(true)
    expect(eintraege.map(([pfad]) => pfad)).toContain(EINGERASTET_VERSION.pfad)
  })

  it('leert einen Punkt ohne Treffer, etwa ohne geladenes Netz', () => {
    const eintraege = einrastenSchreibt({ unten: { stand: null, treffer: null }, oben: 'leer' })
    expect(eintraege.slice(0, 4)).toEqual(LEER_UNTEN)
    expect(eintraege.at(-1)).toEqual([EINGERASTET_VERSION.pfad, ''])
  })

  it('schreibt für einen noch unbekannten Punkt nichts', () => {
    const eintraege = einrastenSchreibt({ unten: 'leer', oben: undefined })
    expect(eintraege).toEqual(LEER_UNTEN)
  })

  it('schreibt den Stand, sobald ein Punkt getroffen hat', () => {
    const eintraege = einrastenSchreibt({ unten: ENZ, oben: undefined })
    expect(eintraege.at(-1)).toEqual([EINGERASTET_VERSION.pfad, 'AWGN 2025-05-01'])
  })
})

describe('nurGeaenderte', () => {
  it('lässt weg, was schon so im Entwurf steht', () => {
    const entwurf: Partial<Record<AntwortPfad, string>> = {
      'probestrecke.eingerastet_rw_unten': '478012',
    }
    const eintraege = nurGeaenderte(
      [
        ['probestrecke.eingerastet_rw_unten', '478012'],
        ['probestrecke.eingerastet_hw_unten', '5420033'],
      ],
      (pfad) => entwurf[pfad],
    )
    expect(eintraege).toEqual([['probestrecke.eingerastet_hw_unten', '5420033']])
  })

  it('liest eine fehlende Antwort als leer', () => {
    expect(nurGeaenderte([['probestrecke.eingerastet_rw_unten', '']], () => undefined)).toEqual(
      [],
    )
  })
})
