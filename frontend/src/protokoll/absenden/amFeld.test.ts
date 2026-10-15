import { describe, expect, it } from 'vitest'
import { bekannteMeldung, feldMeldung, istAusgefuellt } from './amFeld'

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
