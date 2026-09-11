import { describe, expect, it, vi } from 'vitest'
import { ApiFehler } from '../../api/fehler'
import { anlagenDateiUrl, ladeAnlageHoch, listeAnlagen, loescheAnlage } from './api'

/* Same arrangement as entwurf/api.test.ts: the fetch is handed in, so these need
   no browser and no stubbed global. What is checked is the method, the path and
   the body, because those are what the backend contract is made of. */
function fakeFetch(koerper: unknown, status = 200) {
  return vi.fn(
    async (_pfad: RequestInfo | URL, _optionen?: RequestInit) =>
      new Response(status === 204 ? null : JSON.stringify(koerper), {
        status,
        headers: status === 204 ? undefined : { 'Content-Type': 'application/json' },
      }),
  )
}

const ANLAGE = {
  id: 'b2',
  submission_id: 'a1',
  art: 'FOTO' as const,
  dateiname: 'schussen.jpg',
  mime_type: 'image/jpeg',
  groesse: 4096,
  created_at: '2026-09-10T08:00:00Z',
}

function bild(name = 'schussen.jpg', typ = 'image/jpeg') {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: typ })
}

describe('listeAnlagen', () => {
  it('asks the protocol for its attachments', async () => {
    const fetchImpl = fakeFetch([ANLAGE])

    const anlagen = await listeAnlagen('a1', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/protokolle/a1/anlagen',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(anlagen).toEqual([ANLAGE])
  })

  /* An id reaches this from the address bar, so it is never trusted to be a
     path segment on its own. */
  it('encodes the protocol id', async () => {
    const fetchImpl = fakeFetch([])

    await listeAnlagen('a/../b', { fetchImpl })

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/protokolle/a%2F..%2Fb/anlagen')
  })
})

describe('ladeAnlageHoch', () => {
  it('posts the kind and the file as multipart form data', async () => {
    const fetchImpl = fakeFetch(ANLAGE, 201)

    const anlage = await ladeAnlageHoch({
      entwurfId: 'a1',
      art: 'FOTO',
      datei: bild(),
      fetchImpl,
    })

    const [pfad, optionen] = fetchImpl.mock.calls[0]
    expect(pfad).toBe('/api/v1/protokolle/a1/anlagen')
    expect(optionen?.method).toBe('POST')

    const koerper = optionen?.body as FormData
    expect(koerper).toBeInstanceOf(FormData)
    expect(koerper.get('art')).toBe('FOTO')
    expect((koerper.get('datei') as File).name).toBe('schussen.jpg')
    expect(anlage).toEqual(ANLAGE)
  })

  /* The one case where writing Content-Type ourselves breaks the request. A
     multipart body is split by a boundary the browser invents per request, and
     the header has to name that exact string; a header we wrote would name no
     boundary and the backend would find no parts at all. */
  it('sets no Content-Type, so the browser can name its own boundary', async () => {
    const fetchImpl = fakeFetch(ANLAGE, 201)

    await ladeAnlageHoch({ entwurfId: 'a1', art: 'FOTO', datei: bild(), fetchImpl })

    expect(fetchImpl.mock.calls[0][1]?.headers).toBeUndefined()
  })

  it('sends the map excerpt under its own kind', async () => {
    const fetchImpl = fakeFetch({ ...ANLAGE, art: 'KARTENAUSSCHNITT' }, 201)

    await ladeAnlageHoch({
      entwurfId: 'a1',
      art: 'KARTENAUSSCHNITT',
      datei: bild('karte.png', 'image/png'),
      fetchImpl,
    })

    const koerper = fetchImpl.mock.calls[0][1]?.body as FormData
    expect(koerper.get('art')).toBe('KARTENAUSSCHNITT')
  })

  /* The refusal carries the backend's own sentence, which already names the
     file and says what to do. useAnlagen shows it as it stands. */
  it('rejects with the code and the sentence the backend sent', async () => {
    const fetchImpl = fakeFetch(
      { code: 'ANLAGE_INHALT_KEIN_BILD', nachricht: 'karte.jpg: kein Bild.' },
      422,
    )

    await expect(
      ladeAnlageHoch({ entwurfId: 'a1', art: 'FOTO', datei: bild(), fetchImpl }),
    ).rejects.toMatchObject({
      code: 'ANLAGE_INHALT_KEIN_BILD',
      status: 422,
      nachricht: 'karte.jpg: kein Bild.',
    })
  })
})

describe('loescheAnlage', () => {
  it('deletes one attachment of one protocol', async () => {
    const fetchImpl = fakeFetch(null, 204)

    await loescheAnlage('a1', 'b2', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/protokolle/a1/anlagen/b2',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('rejects rather than resolving quietly when the server refuses', async () => {
    const fetchImpl = fakeFetch({ code: 'ANLAGE_NICHT_GEFUNDEN', nachricht: 'weg.' }, 404)

    await expect(loescheAnlage('a1', 'b2', { fetchImpl })).rejects.toBeInstanceOf(ApiFehler)
  })
})

describe('anlagenDateiUrl', () => {
  /* The one "call" that is not a call: an <img> asks for this itself, with the
     session cookie riding along because it is same-origin. That is what retires
     the object URLs feature 10 had to remember to revoke. */
  it('names the protocol as well as the attachment', () => {
    expect(anlagenDateiUrl('a1', 'b2')).toBe('/api/v1/protokolle/a1/anlagen/b2/datei')
  })

  it('encodes both ids', () => {
    expect(anlagenDateiUrl('a/1', 'b 2')).toBe('/api/v1/protokolle/a%2F1/anlagen/b%202/datei')
  })
})
