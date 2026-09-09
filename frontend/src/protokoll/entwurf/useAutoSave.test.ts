import { describe, expect, it } from 'vitest'
import {
  ANTWORT_UNLESBAR,
  ApiFehler,
  NETZWERK_FEHLER,
  NICHT_ANGEMELDET,
  PROTOKOLL_VERAENDERT,
} from '../../api/fehler'
import { fehlerZustand } from './useAutoSave'

/* Only the mapping is tested here, not the hook around it. The debounce, the
   refs and the effect need React and a browser; what can go wrong without them
   is telling one kind of failed save from another, which is this. */
describe('fehlerZustand', () => {
  /* The protocol moved on somewhere else, so the server wrote nothing and the
     same request would be refused again. Its own state, because it is the one
     save failure a person has to act on rather than wait out. */
  it('calls a 409 a conflict', () => {
    const fehler = new ApiFehler(PROTOKOLL_VERAENDERT, { status: 409 })

    expect(fehlerZustand(fehler)).toEqual({ status: 'conflict' })
  })

  /* Everything else is an ordinary failure: the next save may well work, and the
     safety copy is holding what was typed until one does. Calling any of these a
     conflict would send somebody hunting for a second tab that does not
     exist. */
  it.each([
    ['an unreachable backend', NETZWERK_FEHLER],
    ['an answer we could not read', ANTWORT_UNLESBAR],
    ['a session that has run out', NICHT_ANGEMELDET],
  ])('calls %s an ordinary failure', (_name, code) => {
    expect(fehlerZustand(new ApiFehler(code))).toEqual({ status: 'failed' })
  })

  /* A bug in our own code, or whatever a library threw. There is nothing
     truthful to say about it beyond that the save did not happen. */
  it('calls something that is not an ApiFehler at all an ordinary failure', () => {
    expect(fehlerZustand(new TypeError('kaputt'))).toEqual({ status: 'failed' })
    expect(fehlerZustand(undefined)).toEqual({ status: 'failed' })
  })
})
