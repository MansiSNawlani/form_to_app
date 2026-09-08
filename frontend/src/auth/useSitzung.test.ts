import { describe, expect, it } from 'vitest'
import { sitzungAus } from './useSitzung'
import type { BenutzerAntwort } from '../api/typen'

const benutzer: BenutzerAntwort = {
  id: '77b00b89-0406-446d-aab8-e26ab734a2b8',
  email: 'test@ffs.de',
  rollen: ['SUBMITTER'],
  regierungspraesidium: null,
  locale: 'de',
  ist_aktiv: true,
}

describe('sitzungAus', () => {
  it('reports still-checking before the first answer', () => {
    expect(sitzungAus({ isPending: true, isError: false, data: undefined })).toEqual({
      zustand: 'wird_geprueft',
    })
  })

  it('reports the account once it arrives', () => {
    expect(sitzungAus({ isPending: false, isError: false, data: benutzer })).toEqual({
      zustand: 'angemeldet',
      benutzer,
    })
  })

  it('reports signed out when the backend said so', () => {
    expect(sitzungAus({ isPending: false, isError: false, data: null })).toEqual({
      zustand: 'abgemeldet',
      grund: 'antwort',
    })
  })

  /* The distinction that stops the login page blaming an expired session for a
     server that was never reached. Both are "you may not see this page"; only
     one of them is anything to do with the person's session. */
  it('tells a server that could not be asked apart from a session that ended', () => {
    const kaputt = sitzungAus({ isPending: false, isError: true, data: undefined })

    expect(kaputt).toEqual({ zustand: 'abgemeldet', grund: 'fehler' })
    expect(sitzungAus({ isPending: false, isError: false, data: null })).not.toEqual(kaputt)
  })

  /* Still-checking wins over everything. A refetch after the window regains
     focus keeps the old data while it runs, and treating that as anything other
     than settled would flicker the page underneath somebody. */
  it('never reports signed out while an answer is still outstanding', () => {
    expect(sitzungAus({ isPending: true, isError: true, data: null })).toEqual({
      zustand: 'wird_geprueft',
    })
  })
})
