import { describe, expect, it, vi } from 'vitest'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN, PROTOKOLL_VERAENDERT } from '../../api/fehler'
import { holeEntwurf, legeEntwurfAn, speichereAntworten } from './api'

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
