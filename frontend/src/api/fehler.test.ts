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

  /* A code the locale file knows has no use for the backend's German: the key is
     looked up in the language the person chose. */
  it('uses the locale key for a server code the locale file knows', () => {
    const fehler = new ApiFehler('ROLLEN_LEER', { status: 422, nachricht: 'Das Konto hat keine Rolle.' })

    expect(fehlertext(fehler, { ROLLEN_LEER: 'Keine Rolle.' })).toEqual({
      art: 'schluessel',
      schluessel: 'fehler.server.ROLLEN_LEER',
      werte: {},
    })
  })

  it('hands the values the server sent to the key', () => {
    const fehler = new ApiFehler('ANLAGE_INHALT_KEIN_BILD', {
      nachricht: 'Foto.jpg: Kein Bild.',
      werte: { dateiname: 'Foto.jpg' },
    })

    expect(
      fehlertext(fehler, { ANLAGE_INHALT_KEIN_BILD: '„{{dateiname}}“: Kein Bild.' }),
    ).toEqual({
      art: 'schluessel',
      schluessel: 'fehler.server.ANLAGE_INHALT_KEIN_BILD',
      werte: { dateiname: 'Foto.jpg' },
    })
  })

  /* A raw "{{dateiname}}" on screen is worse than German: it reads as broken. */
  it('keeps the backend sentence when a placeholder would go unfilled', () => {
    const fehler = new ApiFehler('PDF_NICHT_LESBAR', { nachricht: 'Nicht lesbar.' })

    expect(fehlertext(fehler, { PDF_NICHT_LESBAR: '„{{dateiname}}“: nicht lesbar.' })).toEqual({
      art: 'text',
      text: 'Nicht lesbar.',
    })
  })

  it('picks the sentence for the kind of attachment the server names', () => {
    const fehler = new ApiFehler('ANLAGENART_VOLL', {
      nachricht: 'Voll.',
      werte: { dateiname: 'karte.png', art: 'KARTENAUSSCHNITT', vorhanden: 1, hoechstens: 1 },
    })

    const texte = { ANLAGENART_VOLL_FOTO: 'Fotos voll.', ANLAGENART_VOLL_KARTENAUSSCHNITT: 'Karte da.' }

    expect(fehlertext(fehler, texte)).toMatchObject({
      art: 'schluessel',
      schluessel: 'fehler.server.ANLAGENART_VOLL_KARTENAUSSCHNITT',
    })
  })

  /* What remains of the design before 17e: a code added to the API after the
     locale files were last written still says something useful. */
  it('shows the backend its own sentence for a code we have no wording for', () => {
    const fehler = new ApiFehler('ANMELDUNG_FEHLGESCHLAGEN', {
      status: 401,
      nachricht: 'E-Mail-Adresse oder Passwort ist nicht richtig.',
    })

    expect(fehlertext(fehler, {})).toEqual({
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
