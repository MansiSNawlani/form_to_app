import { describe, expect, it } from 'vitest'
import { ApiFehler, NETZWERK_FEHLER, PROTOKOLL_NICHT_GEFUNDEN } from '../../api/fehler'
import { entwurfsKey, protokolleKey, sollWiederholen } from './abfragen'

describe('entwurfsKey', () => {
  /* Two protocols must never share a cache entry, or opening one would show the
     other's answers. */
  it('gives each protocol its own key', () => {
    expect(entwurfsKey('a1')).not.toEqual(entwurfsKey('b2'))
  })
})

describe('protokolleKey', () => {
  /* The list and a protocol live in the same cache. If the list's key were a
     prefix of a protocol's, invalidating the list after a delete would throw
     away the open form's document too, and with it the version the next save
     has to quote. */
  it('shares no prefix with a protocol of its own', () => {
    expect(protokolleKey()).not.toEqual(entwurfsKey('protokolle'))
    expect(entwurfsKey('a1').slice(0, 1)).not.toEqual(protokolleKey().slice(0, 1))
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
