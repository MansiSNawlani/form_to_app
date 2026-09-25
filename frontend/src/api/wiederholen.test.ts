import { describe, expect, it } from 'vitest'
import {
  ANTWORT_UNLESBAR,
  ApiFehler,
  NETZWERK_FEHLER,
  NICHT_ANGEMELDET,
  ROLLE_FEHLT,
} from './fehler'
import { sollWiederholen } from './wiederholen'

describe('sollWiederholen', () => {
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
