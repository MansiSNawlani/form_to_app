import { describe, expect, it } from 'vitest'
import { bekannteMeldung, blockAnzeige, feldMeldung, istAusgefuellt } from './amFeld'

describe('istAusgefuellt', () => {
  it('zählt Text, der nicht nur aus Leerzeichen besteht', () => {
    expect(istAusgefuellt('Neckar')).toBe(true)
    expect(istAusgefuellt('0')).toBe(true)
  })

  it('zählt Leeres, Leerzeichen und Fehlendes nicht', () => {
    expect(istAusgefuellt('')).toBe(false)
    expect(istAusgefuellt('   ')).toBe(false)
    expect(istAusgefuellt(undefined)).toBe(false)
    expect(istAusgefuellt(null)).toBe(false)
  })
})

describe('feldMeldung', () => {
  const server = 'protokoll.regeln.pflichtfeld'
  const browser = 'protokoll.regeln.koordinateAusserhalb'

  it('zeigt die Meldung des Browsers vor der des Servers', () => {
    expect(feldMeldung(browser, server, '')).toBe(browser)
  })

  it('zeigt die Meldung des Servers, solange das Feld leer ist', () => {
    expect(feldMeldung(undefined, server, '')).toBe(server)
    expect(feldMeldung(undefined, server, undefined)).toBe(server)
  })

  it('schweigt über die Meldung des Servers, sobald etwas eingetragen ist', () => {
    expect(feldMeldung(undefined, server, 'Neckar')).toBeUndefined()
  })

  it('schweigt, wenn niemand etwas zu sagen hat', () => {
    expect(feldMeldung(undefined, undefined, '')).toBeUndefined()
  })
})

describe('bekannteMeldung', () => {
  it('reicht einen bekannten Schlüssel durch', () => {
    expect(bekannteMeldung('protokoll.regeln.pflichtfeld', () => true)).toBe(
      'protokoll.regeln.pflichtfeld',
    )
  })

  /* A backend deployed ahead of the browser can name a rule this locale file has
     never heard of. */
  it('ersetzt einen unbekannten Schlüssel durch den allgemeinen Satz', () => {
    expect(bekannteMeldung('protokoll.regeln.gibtEsNicht', () => false)).toBe(
      'protokoll.absenden.probleme.unbekannteRegel',
    )
  })
})

describe('blockAnzeige', () => {
  const server = 'protokoll.regeln.fehltBlock'
  const browser = 'protokoll.regeln.summeNicht100'

  it('zeigt die Meldung des Servers und den Rahmen, solange der Block nicht erledigt ist', () => {
    expect(blockAnzeige(undefined, server, false)).toEqual({ meldung: server, abgelehnt: true })
  })

  it('lässt dem Browser den Vortritt, behält aber den Rahmen', () => {
    expect(blockAnzeige(browser, server, false)).toEqual({ meldung: browser, abgelehnt: true })
  })

  it('nimmt Meldung und Rahmen des Servers zurück, sobald der Block erledigt ist', () => {
    expect(blockAnzeige(undefined, server, true)).toEqual({ meldung: undefined, abgelehnt: false })
  })

  it('zeigt die eigene Meldung des Browsers auch ohne Ablehnung, ohne Rahmen', () => {
    expect(blockAnzeige(browser, undefined, false)).toEqual({ meldung: browser, abgelehnt: false })
  })
})
