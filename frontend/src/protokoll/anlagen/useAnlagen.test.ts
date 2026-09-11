import { describe, expect, it } from 'vitest'
import { ANTWORT_UNLESBAR, ApiFehler, NETZWERK_FEHLER, NICHT_ANGEMELDET } from '../../api/fehler'
import { fehlerMeldung } from './useAnlagen'

/* Only the mapping is tested here, not the hook around it. The effects and the
   state need React and a browser; what can go wrong without them is telling one
   kind of failed upload from another, which is this. The same arrangement
   entwurf/useAutoSave.test.ts uses for fehlerZustand. */
describe('fehlerMeldung', () => {
  /* The backend's own sentence, shown as it stands. It was written to this
     project's standard: it names the file, says why without a MIME type or a
     byte count, and ends with something the reader can actually do. A German
     sentence of our own beside it would be two wordings to keep in step. */
  it('passes the backend refusal through word for word', () => {
    const fehler = new ApiFehler('ANLAGE_INHALT_KEIN_BILD', {
      status: 422,
      nachricht: 'karte.jpg: Der Name dieser Datei sagt Bild, ihr Inhalt ist aber keines.',
    })

    expect(fehlerMeldung(fehler, 'karte.jpg')).toEqual({
      text: 'karte.jpg: Der Name dieser Datei sagt Bild, ihr Inhalt ist aber keines.',
    })
  })

  /* A proxy in front of the service answers 413 for a body past its own limit,
     and that answer is its HTML rather than our JSON, so it arrives with no
     code and no sentence. It means the same thing to the person reading, so it
     gets the same message. */
  it('calls an unreadable 413 a file that is too big', () => {
    const fehler = new ApiFehler(ANTWORT_UNLESBAR, { status: 413 })

    expect(fehlerMeldung(fehler, 'riesig.jpg')).toEqual({
      schluessel: 'protokoll.anlagen.fehler.groesseServer',
      werte: { dateiname: 'riesig.jpg' },
    })
  })

  /* And our own 413 takes the same route, so the two are one message rather
     than two that have to be kept saying the same thing. */
  it('treats our own 413 the same way', () => {
    const fehler = new ApiFehler('ANLAGE_ZU_GROSS', {
      status: 413,
      nachricht: 'riesig.jpg: Diese Datei ist zu groß.',
    })

    expect(fehlerMeldung(fehler, 'riesig.jpg')).toEqual({
      schluessel: 'protokoll.anlagen.fehler.groesseServer',
      werte: { dateiname: 'riesig.jpg' },
    })
  })

  /* Nothing answered at all. Ours to describe, and the important half is that
     the file was not stored, so nobody walks away thinking it was. */
  it('says an unreachable server stored nothing', () => {
    const fehler = new ApiFehler(NETZWERK_FEHLER)

    expect(fehlerMeldung(fehler, 'foto.jpg')).toEqual({
      schluessel: 'protokoll.anlagen.fehler.nichtGesendet',
      werte: { dateiname: 'foto.jpg' },
    })
  })

  /* A session that ran out does carry a sentence, and the backend's one already
     says to sign in again and how long a session lasts. */
  it('passes a session that has run out through with its own wording', () => {
    const fehler = new ApiFehler(NICHT_ANGEMELDET, {
      status: 401,
      nachricht: 'Sie sind nicht angemeldet, oder Ihre Sitzung ist abgelaufen.',
    })

    expect(fehlerMeldung(fehler, 'foto.jpg')).toEqual({
      text: 'Sie sind nicht angemeldet, oder Ihre Sitzung ist abgelaufen.',
    })
  })

  /* A bug in our own code, or whatever a library threw. There is nothing
     truthful to say beyond that the file did not go up. */
  it('falls back for something that is not an ApiFehler at all', () => {
    expect(fehlerMeldung(new TypeError('kaputt'), 'foto.jpg')).toEqual({
      schluessel: 'protokoll.anlagen.fehler.nichtGesendet',
      werte: { dateiname: 'foto.jpg' },
    })
    expect(fehlerMeldung(undefined, 'foto.jpg')).toEqual({
      schluessel: 'protokoll.anlagen.fehler.nichtGesendet',
      werte: { dateiname: 'foto.jpg' },
    })
  })
})
