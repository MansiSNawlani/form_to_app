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

  /* A 502 from the reverse proxy is HTML, not our shape. Reading it as a refusal
     would put a page of markup in front of somebody as an error message. */
  it('reports an unreadable body rather than trusting it', async () => {
    const fetchImpl = fakeFetch(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const fehler = await apiAnfrage('/ich', { fetchImpl }).catch((f: unknown) => f)

    expect(fehler).toMatchObject({ code: ANTWORT_UNLESBAR, status: 502 })
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
