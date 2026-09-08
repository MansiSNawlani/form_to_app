import { describe, expect, it } from 'vitest'
import { ANTWORT_UNLESBAR, ApiFehler, fehlertext, NETZWERK_FEHLER } from './fehler'

describe('fehlertext', () => {
  it('uses our own wording for a code the backend never sees', () => {
    expect(fehlertext(new ApiFehler(NETZWERK_FEHLER))).toEqual({
      art: 'schluessel',
      schluessel: 'fehler.netzwerk',
    })

    expect(fehlertext(new ApiFehler(ANTWORT_UNLESBAR, { status: 502 }))).toEqual({
      art: 'schluessel',
      schluessel: 'fehler.unlesbar',
    })
  })

  /* The case that carries the whole design: the backend owns the wording for its
     own refusals, and this file does not keep a second German copy of them. */
  it('shows the backend its own sentence for a code we have no wording for', () => {
    const fehler = new ApiFehler('ANMELDUNG_FEHLGESCHLAGEN', {
      status: 401,
      nachricht: 'E-Mail-Adresse oder Passwort ist nicht richtig.',
    })

    expect(fehlertext(fehler)).toEqual({
      art: 'text',
      text: 'E-Mail-Adresse oder Passwort ist nicht richtig.',
    })
  })

  it('falls back to the generic message when there is no sentence to show', () => {
    const fehler = new ApiFehler('EIN_KUENFTIGER_CODE', { status: 418 })

    expect(fehlertext(fehler)).toEqual({
      art: 'schluessel',
      schluessel: 'fehler.unbekannt',
    })
  })

  it('falls back for anything that is not an ApiFehler at all', () => {
    const erwartet = { art: 'schluessel', schluessel: 'fehler.unbekannt' }

    expect(fehlertext(new TypeError('undefined is not a function'))).toEqual(erwartet)
    expect(fehlertext(undefined)).toEqual(erwartet)
    expect(fehlertext('kaputt')).toEqual(erwartet)
  })
})

describe('ApiFehler', () => {
  it('keeps the code, the status and the sentence apart', () => {
    const fehler = new ApiFehler('ROLLE_FEHLT', { status: 403, nachricht: 'Keine Berechtigung.' })

    expect(fehler.code).toBe('ROLLE_FEHLT')
    expect(fehler.status).toBe(403)
    expect(fehler.nachricht).toBe('Keine Berechtigung.')
    expect(fehler).toBeInstanceOf(Error)
  })

  it('reports no status when nothing ever answered', () => {
    const fehler = new ApiFehler(NETZWERK_FEHLER)

    expect(fehler.status).toBeNull()
    expect(fehler.nachricht).toBeNull()
  })
})
