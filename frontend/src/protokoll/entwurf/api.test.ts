import { describe, expect, it, vi } from 'vitest'
import {
  ApiFehler,
  NICHT_ANGEMELDET,
  PROTOKOLL_NICHT_GEFUNDEN,
  PROTOKOLL_UNVOLLSTAENDIG,
  PROTOKOLL_VERAENDERT,
} from '../../api/fehler'
import {
  absendeProtokoll,
  holeEntwurf,
  legeEntwurfAn,
  listeProtokolle,
  loescheEntwurf,
  speichereAntworten,
} from './api'

/* Same arrangement as api/client.test.ts: the fetch is handed in, so these tests
   need no browser and no stubbed global. What is checked here is the method, the
   path and the body, because those are what the backend contract is made of. */
function fakeFetch(koerper: unknown, status = 200) {
  return vi.fn(
    async (_pfad: RequestInfo | URL, _optionen?: RequestInit) =>
      new Response(status === 204 ? null : JSON.stringify(koerper), {
        status,
        headers: status === 204 ? undefined : { 'Content-Type': 'application/json' },
      }),
  )
}

const ENTWURF = {
  id: 'a1',
  status: 'DRAFT',
  form_version: '20260609',
  version: 1,
  antworten: {},
  created_at: '2026-09-09T08:00:00Z',
  updated_at: '2026-09-09T08:00:00Z',
}

/* A summary carries no answers at all: the five display values are read out of
   the document by the query that builds the list. */
const UEBERSICHT = {
  id: 'a1',
  status: 'DRAFT',
  form_version: '20260609',
  version: 1,
  created_at: '2026-09-09T08:00:00Z',
  updated_at: '2026-09-09T08:00:00Z',
  gewaessername: 'Schussen',
  ortsangabe: 'Weißenau',
  laenge: '120',
  datum: '2026-08-14',
  anlass: 'wrrl_monitoring',
}

function aufruf(fetchImpl: ReturnType<typeof fakeFetch>) {
  const [pfad, optionen] = fetchImpl.mock.calls[0]
  return { pfad: pfad as string, optionen: optionen as RequestInit }
}

describe('legeEntwurfAn', () => {
  it('posts to the collection with no body and returns the new draft', async () => {
    const fetchImpl = fakeFetch(ENTWURF, 201)

    await expect(legeEntwurfAn({ fetchImpl })).resolves.toEqual(ENTWURF)

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toBe('/api/v1/protokolle')
    expect(optionen.method).toBe('POST')
    expect(optionen.body).toBeUndefined()
  })
})

describe('listeProtokolle', () => {
  it('gets the collection and hands back the summaries in the order they arrived', async () => {
    const fetchImpl = fakeFetch([UEBERSICHT, { ...UEBERSICHT, id: 'b2' }])

    const zeilen = await listeProtokolle({ fetchImpl })

    expect(zeilen.map((zeile) => zeile.id)).toEqual(['a1', 'b2'])

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toBe('/api/v1/protokolle')
    expect(optionen.method).toBe('GET')
    expect(optionen.body).toBeUndefined()
  })

  /* Nobody signed in has no list to show, and the page has to send them to the
     login screen rather than print "keine Protokolle" at them. */
  it('surfaces a 401 as a typed error', async () => {
    const fetchImpl = fakeFetch(
      { code: NICHT_ANGEMELDET, nachricht: 'Bitte melden Sie sich an.' },
      401,
    )

    const fehler = await listeProtokolle({ fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler).toMatchObject({ code: NICHT_ANGEMELDET, status: 401 })
  })
})

describe('holeEntwurf', () => {
  it('gets the one protocol, answers included', async () => {
    const fetchImpl = fakeFetch(ENTWURF)

    await expect(holeEntwurf('a1', { fetchImpl })).resolves.toEqual(ENTWURF)

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toBe('/api/v1/protokolle/a1')
    expect(optionen.method).toBe('GET')
  })

  /* An id out of the URL bar is whatever somebody typed. It reaches the path
     segment escaped rather than raw, so a slash in it cannot address a different
     endpoint than the one this function names. */
  it('escapes the id rather than pasting it into the path', async () => {
    const fetchImpl = fakeFetch(ENTWURF)

    await holeEntwurf('a1/../andere', { fetchImpl })

    expect(aufruf(fetchImpl).pfad).toBe('/api/v1/protokolle/a1%2F..%2Fandere')
  })

  /* Somebody else's protocol answers exactly as a missing one does, and the
     browser has to be able to tell that apart from a failure by the code rather
     than by a sentence somebody may reword. */
  it('surfaces a 404 as a typed error carrying the published code', async () => {
    const fetchImpl = fakeFetch(
      { code: PROTOKOLL_NICHT_GEFUNDEN, nachricht: 'Dieses Protokoll gibt es nicht.' },
      404,
    )

    const fehler = await holeEntwurf('a1', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler).toMatchObject({ code: PROTOKOLL_NICHT_GEFUNDEN, status: 404 })
  })
})

describe('loescheEntwurf', () => {
  it('deletes the one protocol and expects no answer back', async () => {
    const fetchImpl = fakeFetch(null, 204)

    await expect(loescheEntwurf('a1', { fetchImpl })).resolves.toBeUndefined()

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toBe('/api/v1/protokolle/a1')
    expect(optionen.method).toBe('DELETE')
  })

  it('escapes the id rather than pasting it into the path', async () => {
    const fetchImpl = fakeFetch(null, 204)

    await loescheEntwurf('a1/../andere', { fetchImpl })

    expect(aufruf(fetchImpl).pfad).toBe('/api/v1/protokolle/a1%2F..%2Fandere')
  })

  /* A protocol that has been submitted is no longer the surveyor's to throw
     away, and the backend refuses with a 409. The row has to stay and say so
     rather than disappear from a list it is still in. */
  it('surfaces a 409 as a typed error', async () => {
    const fetchImpl = fakeFetch(
      { code: PROTOKOLL_VERAENDERT, nachricht: 'Dieses Protokoll ist kein Entwurf mehr.' },
      409,
    )

    const fehler = await loescheEntwurf('a1', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler).toMatchObject({ status: 409 })
  })
})

describe('speichereAntworten', () => {
  it('puts the whole document and the version it started from', async () => {
    const fetchImpl = fakeFetch({
      id: 'a1',
      status: 'DRAFT',
      version: 4,
      updated_at: '2026-09-09T09:00:00Z',
    })

    const antwort = await speichereAntworten({
      id: 'a1',
      version: 3,
      antworten: { anlass: 'wrrl', messdaten: { temperatur: '12' } },
      fetchImpl,
    })

    expect(antwort.version).toBe(4)

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toBe('/api/v1/protokolle/a1/antworten')
    expect(optionen.method).toBe('PUT')
    expect(JSON.parse(optionen.body as string)).toEqual({
      version: 3,
      antworten: { anlass: 'wrrl', messdaten: { temperatur: '12' } },
    })
  })

  /* The one save failure where trying again cannot help: the protocol has moved
     on, so the same request would be refused again. The caller needs the code to
     tell it apart from a network hiccup. */
  it('surfaces a 409 as PROTOKOLL_VERAENDERT', async () => {
    const fetchImpl = fakeFetch(
      { code: PROTOKOLL_VERAENDERT, nachricht: 'Dieses Protokoll wurde zwischenzeitlich geändert.' },
      409,
    )

    const fehler = await speichereAntworten({
      id: 'a1',
      version: 1,
      antworten: {},
      fetchImpl,
    }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: PROTOKOLL_VERAENDERT, status: 409 })
  })
})

describe('absendeProtokoll', () => {
  const ABGESENDET = {
    id: 'a1',
    status: 'SUBMITTED',
    version: 8,
    submitted_at: '2026-09-11T14:32:00Z',
  }

  it('postet die Version an den Absende-Pfad', async () => {
    const fetchImpl = fakeFetch(ABGESENDET)

    const antwort = await absendeProtokoll({ id: 'a1', version: 7, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/protokolle/a1/absenden',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: 7 }) }),
    )
    expect(antwort).toEqual(ABGESENDET)
  })

  /* The refusal the panel draws. Order is the server's, which is section order,
     so somebody repairing a protocol walks the form from the top. */
  it('traegt die Verstoesse in der gesendeten Reihenfolge', async () => {
    const verstoesse = [
      { pfad: 'probestrecke.gewaesser.gewaessername', schluessel: 'protokoll.regeln.fehlt' },
      { pfad: 'umland', schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ]
    const fetchImpl = fakeFetch(
      { code: 'PROTOKOLL_UNVOLLSTAENDIG', nachricht: 'Nicht abgesendet.', verstoesse },
      422,
    )

    const fehler = await absendeProtokoll({ id: 'a1', version: 7, fetchImpl }).catch(
      (grund: unknown) => grund,
    )

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe(PROTOKOLL_UNVOLLSTAENDIG)
    expect((fehler as ApiFehler).verstoesse).toEqual(verstoesse)
  })

  /* Every other refusal leaves the field out, and reading it must not crash the
     screen that was about to draw a list. */
  it('kommt ohne Verstossliste zurecht', async () => {
    const fetchImpl = fakeFetch(
      { code: 'PROTOKOLL_VERAENDERT', nachricht: 'Zwischendurch geaendert.' },
      409,
    )

    const fehler = await absendeProtokoll({ id: 'a1', version: 7, fetchImpl }).catch(
      (grund: unknown) => grund,
    )

    expect((fehler as ApiFehler).code).toBe(PROTOKOLL_VERAENDERT)
    expect((fehler as ApiFehler).verstoesse).toEqual([])
  })

  /* A malformed entry is dropped rather than drawn as an empty row with nowhere
     to go. The sentence is still there, so the person is not left with nothing. */
  it('verwirft Eintraege, die kein Pfad und kein Schluessel sind', async () => {
    const fetchImpl = fakeFetch(
      {
        code: 'PROTOKOLL_UNVOLLSTAENDIG',
        nachricht: 'Nicht abgesendet.',
        verstoesse: [{ pfad: 'anlass' }, null, { pfad: 'datum', schluessel: 'protokoll.regeln.fehlt' }],
      },
      422,
    )

    const fehler = await absendeProtokoll({ id: 'a1', version: 7, fetchImpl }).catch(
      (grund: unknown) => grund,
    )

    expect((fehler as ApiFehler).verstoesse).toEqual([
      { pfad: 'datum', schluessel: 'protokoll.regeln.fehlt' },
    ])
    expect((fehler as ApiFehler).nachricht).toBe('Nicht abgesendet.')
  })
})
