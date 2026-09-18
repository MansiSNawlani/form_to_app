import { describe, expect, it } from 'vitest'
import {
  ANTWORT_UNLESBAR,
  ApiFehler,
  NETZWERK_FEHLER,
  NICHT_ANGEMELDET,
  ROLLE_FEHLT,
} from '../../api/fehler'
import { prueflisteKey, sollWiederholen } from './abfragen'
import { mitAenderung, STANDARD } from './parameter'

describe('sollWiederholen', () => {
  /* A refusal is a settled answer about the caller, not a hiccup. Retrying it
     twice only makes somebody wait through three requests to be told the same
     no, and it is not even a no they can do anything about by waiting. */
  it('gives up at once on a refusal', () => {
    expect(sollWiederholen(0, new ApiFehler(ROLLE_FEHLT, { status: 403 }))).toBe(false)
    expect(sollWiederholen(0, new ApiFehler(NICHT_ANGEMELDET, { status: 401 }))).toBe(false)
  })

  it('tries again for a failure that waiting could fix', () => {
    expect(sollWiederholen(0, new ApiFehler(NETZWERK_FEHLER))).toBe(true)
    expect(sollWiederholen(1, new ApiFehler(ANTWORT_UNLESBAR, { status: 500 }))).toBe(true)
  })

  it('stops trying eventually', () => {
    expect(sollWiederholen(2, new ApiFehler(NETZWERK_FEHLER))).toBe(false)
  })

  it('tries again for something that is not an ApiFehler at all', () => {
    expect(sollWiederholen(0, new Error('boom'))).toBe(true)
  })
})

describe('prueflisteKey', () => {
  /* Two selections that ask the server the same question are one cached answer.
     Keyed on the selection object instead, these would be two entries holding
     identical rows. */
  it('is the same key for two selections the endpoint cannot tell apart', () => {
    const eine = mitAenderung(STANDARD, { suche: 'Argen' })
    const andere = mitAenderung(STANDARD, { suche: '  Argen  ' })

    expect(prueflisteKey(eine)).toEqual(prueflisteKey(andere))
  })

  it('is a different key for a different page and for a different filter', () => {
    expect(prueflisteKey(mitAenderung(STANDARD, { seite: 2 }))).not.toEqual(
      prueflisteKey(STANDARD),
    )
    expect(prueflisteKey(mitAenderung(STANDARD, { status: 'alle' }))).not.toEqual(
      prueflisteKey(STANDARD),
    )
  })
})
