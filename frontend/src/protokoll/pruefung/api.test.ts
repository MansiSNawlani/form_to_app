import { describe, expect, it, vi } from 'vitest'
import {
  ApiFehler,
  BEGRUENDUNG_FEHLT,
  EIGENES_PROTOKOLL,
  UEBERGANG_NICHT_MOEGLICH,
} from '../../api/fehler'
import { entscheide, holeVerlauf, nimmInPruefung } from './api'

/* Same arrangement as protokoll/entwurf/api.test.ts: the fetch is handed in, so
   these need no browser and no stubbed global. What is checked is the method, the
   path and the body, because those are what the backend contract is made of. */
function fakeFetch(koerper: unknown, status = 200) {
  return vi.fn(
    async (_pfad: RequestInfo | URL, _optionen?: RequestInit) =>
      new Response(JSON.stringify(koerper), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

const UEBERGANG = { id: 'a1', status: 'NEEDS_CHANGES', locked_at: null }

const EINTRAG = {
  id: 'e1',
  von_status: 'SUBMITTED',
  nach_status: 'NEEDS_CHANGES',
  kommentar: 'Bitte die Leitfähigkeit nachtragen.',
  akteur_name: 'lehmann@ffs.de',
  created_at: '2026-07-12T16:20:00Z',
}

function aufruf(fetchImpl: ReturnType<typeof fakeFetch>) {
  const [pfad, optionen] = fetchImpl.mock.calls[0]
  return { pfad: pfad as string, optionen: optionen as RequestInit }
}

describe('nimmInPruefung', () => {
  it('posts to the protocol with no body at all', async () => {
    const fetchImpl = fakeFetch({ id: 'a1', status: 'IN_REVIEW', locked_at: null })

    await nimmInPruefung('a1', { fetchImpl })

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toContain('/protokolle/a1/pruefung')
    expect(optionen.method).toBe('POST')
    expect(optionen.body).toBeUndefined()
  })
})

describe('entscheide', () => {
  it('sends the decision and the reason', async () => {
    const fetchImpl = fakeFetch(UEBERGANG)

    await entscheide({
      id: 'a1',
      entscheidung: 'AENDERUNG_ANFORDERN',
      kommentar: 'Bitte die Leitfähigkeit nachtragen.',
      fetchImpl,
    })

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toContain('/protokolle/a1/entscheidung')
    expect(optionen.method).toBe('POST')
    expect(JSON.parse(optionen.body as string)).toEqual({
      entscheidung: 'AENDERUNG_ANFORDERN',
      kommentar: 'Bitte die Leitfähigkeit nachtragen.',
    })
  })

  it('hands back the new status and the moment of locking', async () => {
    const fetchImpl = fakeFetch({
      id: 'a1',
      status: 'LOCKED',
      locked_at: '2026-07-15T09:02:00Z',
    })

    const antwort = await entscheide({ id: 'a1', entscheidung: 'ANNEHMEN', fetchImpl })

    expect(antwort.status).toBe('LOCKED')
    expect(antwort.locked_at).toBe('2026-07-15T09:02:00Z')
  })

  /* Each of the three refusals has to be told apart by the screen, because what
     the reviewer should do about them is different: type a reason, ask a
     colleague, or reload and look again. */
  it.each([
    [422, BEGRUENDUNG_FEHLT],
    [403, EIGENES_PROTOKOLL],
    [409, UEBERGANG_NICHT_MOEGLICH],
  ])('turns a %i into an ApiFehler carrying %s', async (status, code) => {
    const fetchImpl = fakeFetch({ code, nachricht: 'Geht nicht.' }, status)

    await expect(
      entscheide({ id: 'a1', entscheidung: 'ABLEHNEN', fetchImpl }),
    ).rejects.toMatchObject({ code, status })
  })

  it('keeps the backend sentence, which already says what to do', async () => {
    const fetchImpl = fakeFetch(
      { code: BEGRUENDUNG_FEHLT, nachricht: 'Zu dieser Entscheidung gehört eine Begründung.' },
      422,
    )

    const fehler = await entscheide({
      id: 'a1',
      entscheidung: 'ABLEHNEN',
      fetchImpl,
    }).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).nachricht).toContain('Begründung')
  })
})

describe('holeVerlauf', () => {
  it('reads the history of one protocol', async () => {
    const fetchImpl = fakeFetch([EINTRAG])

    const eintraege = await holeVerlauf('a1', { fetchImpl })

    const { pfad, optionen } = aufruf(fetchImpl)
    expect(pfad).toContain('/protokolle/a1/verlauf')
    expect(optionen.method ?? 'GET').toBe('GET')
    expect(eintraege).toHaveLength(1)
    expect(eintraege[0].kommentar).toBe('Bitte die Leitfähigkeit nachtragen.')
  })

  /* A protocol nobody has decided on yet has no history at all, which is the
     ordinary case for anything freshly submitted rather than an error. */
  it('reads an empty history as an empty list', async () => {
    const fetchImpl = fakeFetch([])

    await expect(holeVerlauf('a1', { fetchImpl })).resolves.toEqual([])
  })
})
