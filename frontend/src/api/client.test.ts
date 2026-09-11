import { describe, expect, it, vi } from 'vitest'
import { apiAnfrage } from './client'
import { ANTWORT_UNLESBAR, ApiFehler, NETZWERK_FEHLER } from './fehler'

/* A fetch that answers with whatever the test hands it, and records what it was
 * asked for. Injected rather than stubbed onto globalThis, the same way the
 * draft store takes its storage as an argument: these tests need no browser. */
function fakeFetch(antwort: Response | Error) {
  return vi.fn(async () => {
    if (antwort instanceof Error) throw antwort
    return antwort
  })
}

function jsonAntwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiAnfrage', () => {
  it('returns the parsed body of a successful answer', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ email: 'a@b.de' }))

    await expect(apiAnfrage('/ich', { fetchImpl })).resolves.toEqual({ email: 'a@b.de' })
  })

  it('sends the cookie, the method and the JSON body', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ email: 'a@b.de' }))

    await apiAnfrage('/anmeldung', {
      methode: 'POST',
      koerper: { email: 'a@b.de', passwort: 'geheim' },
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/anmeldung', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":"a@b.de","passwort":"geheim"}',
    })
  })

  /* A save replaces the whole answers document rather than merging into it,
     which is why it is a PUT. The body carries the version it started from. */
  it('sends a PUT with its JSON body', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ version: 4 }))

    await apiAnfrage('/protokolle/abc/antworten', {
      methode: 'PUT',
      koerper: { version: 3, antworten: { anlass: 'wrrl' } },
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/protokolle/abc/antworten', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{"version":3,"antworten":{"anlass":"wrrl"}}',
    })
  })

  /* A file upload, added in feature 3d. The one case where a Content-Type we
     wrote would break the request: a multipart body is split by a boundary the
     browser invents per request, and the header has to name that exact string.
     A header of ours would name no boundary and the backend would find no parts
     at all, so the FormData travels untouched and sets its own. */
  it('sends a FormData as it is, with no Content-Type of ours', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ id: 'b2' }))
    const koerper = new FormData()
    koerper.append('art', 'FOTO')

    await apiAnfrage('/protokolle/abc/anlagen', { methode: 'POST', koerper, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/protokolle/abc/anlagen', {
      method: 'POST',
      credentials: 'same-origin',
      headers: undefined,
      body: koerper,
    })
  })

  /* Not stringified on the way past, which is what would happen if FormData
     were treated as an ordinary object: JSON.stringify(new FormData()) is "{}",
     so the upload would silently become an empty JSON body and the backend
     would refuse it for having no file rather than for anything real. */
  it('does not serialise a FormData into JSON', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ id: 'b2' }))
    const koerper = new FormData()
    koerper.append('art', 'FOTO')

    await apiAnfrage('/protokolle/abc/anlagen', { methode: 'POST', koerper, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/protokolle/abc/anlagen',
      expect.objectContaining({ body: expect.any(FormData) }),
    )
  })

  it('sends a DELETE with no body at all', async () => {
    const fetchImpl = fakeFetch(new Response(null, { status: 204 }))

    await expect(
      apiAnfrage('/protokolle/abc', { methode: 'DELETE', fetchImpl }),
    ).resolves.toBeUndefined()

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/protokolle/abc', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: undefined,
      body: undefined,
    })
  })

  it('resolves with nothing for a 204, rather than trying to read a body', async () => {
    const fetchImpl = fakeFetch(new Response(null, { status: 204 }))

    await expect(apiAnfrage('/abmeldung', { methode: 'POST', fetchImpl })).resolves.toBeUndefined()
  })

  it('turns a refusal into an ApiFehler carrying the published code', async () => {
    const fetchImpl = fakeFetch(
      jsonAntwort({ code: 'NICHT_ANGEMELDET', nachricht: 'Sie sind nicht angemeldet.' }, 401),
    )

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler).toMatchObject({
      code: 'NICHT_ANGEMELDET',
      status: 401,
      nachricht: 'Sie sind nicht angemeldet.',
    })
  })

  /* A 502, 503 or 504 means a proxy could not reach the backend. Nothing we sent
     was wrong, so the person is told the service is down rather than shown a
     page of the proxy's HTML, and certainly not left thinking their password
     was mistaken. */
  it('reports a service that a proxy could not reach', async () => {
    for (const status of [502, 503, 504]) {
      const fetchImpl = fakeFetch(new Response('<html>Bad Gateway</html>', { status }))

      const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

      expect(fehler).toMatchObject({ code: NETZWERK_FEHLER, status })
    }
  })

  it('reports an unreadable body rather than trusting it', async () => {
    const fetchImpl = fakeFetch(new Response('<html>Was ist das</html>', { status: 418 }))

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: ANTWORT_UNLESBAR, status: 418 })
  })

  it('reports an answer that is JSON but not the error shape', async () => {
    const fetchImpl = fakeFetch(jsonAntwort({ detail: 'irgendwas' }, 500))

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: ANTWORT_UNLESBAR, status: 500 })
  })

  it('reports a successful answer whose body will not parse', async () => {
    const fetchImpl = fakeFetch(new Response('nicht json', { status: 200 }))

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: ANTWORT_UNLESBAR, status: 200 })
  })

  /* fetch rejects only when nothing answered at all. Every HTTP status resolves,
     which is why this case cannot be told from the others by looking at a
     status code. */
  it('reports a backend that could not be reached, with no status', async () => {
    const fetchImpl = fakeFetch(new TypeError('Failed to fetch'))

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: NETZWERK_FEHLER, status: null })
    expect((fehler as ApiFehler).cause).toBeInstanceOf(TypeError)
  })
})
