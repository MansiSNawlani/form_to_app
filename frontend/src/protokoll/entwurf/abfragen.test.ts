import { describe, expect, it } from 'vitest'
import { ApiFehler, NETZWERK_FEHLER, PROTOKOLL_NICHT_GEFUNDEN } from '../../api/fehler'
import { entwurfsKey, sollWiederholen } from './abfragen'

describe('entwurfsKey', () => {
  /* Two protocols must never share a cache entry, or opening one would show the
     other's answers. */
  it('gives each protocol its own key', () => {
    expect(entwurfsKey('a1')).not.toEqual(entwurfsKey('b2'))
  })
})

describe('sollWiederholen', () => {
  /* A missing protocol is an answer, not a hiccup. Asking twice more only makes
     the not-found page slower before it says the same thing, and the id is not
     going to start existing in the meantime. */
  it('does not retry a protocol that is not there', () => {
    const fehler = new ApiFehler(PROTOKOLL_NICHT_GEFUNDEN, { status: 404 })

    expect(sollWiederholen(0, fehler)).toBe(false)
  })

  /* A dropped request usually is worth another go, and this is the case where
     giving up immediately would show a failure to somebody whose next attempt
     would have worked. */
  it('retries an unreachable backend, twice', () => {
    const fehler = new ApiFehler(NETZWERK_FEHLER)

    expect(sollWiederholen(0, fehler)).toBe(true)
    expect(sollWiederholen(1, fehler)).toBe(true)
    expect(sollWiederholen(2, fehler)).toBe(false)
  })

  it('retries something that is not an ApiFehler at all', () => {
    expect(sollWiederholen(0, new TypeError('kaputt'))).toBe(true)
  })
})
