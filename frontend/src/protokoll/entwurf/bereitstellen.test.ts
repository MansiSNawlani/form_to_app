import { describe, expect, it, vi } from 'vitest'
import { erstelleBereitsteller } from './bereitstellen'
import { NEU } from './neu'
import type { Entwurf } from './typen'

function entwurf(id: string): Entwurf {
  return {
    id,
    status: 'DRAFT',
    form_version: '20260609',
    version: 1,
    antworten: {},
    created_at: '2026-09-11T08:00:00Z',
    updated_at: '2026-09-11T08:00:00Z',
  }
}

/** A create that does not settle until the test says so. */
function gebremst(id: string) {
  let freigeben: () => void = () => {}
  const tor = new Promise<void>((resolve) => {
    freigeben = resolve
  })
  const anlegen = vi.fn(async () => {
    await tor
    return entwurf(id)
  })
  return { anlegen, freigeben: () => freigeben() }
}

describe('erstelleBereitsteller', () => {
  it('hands back an existing id without creating anything', async () => {
    const anlegen = vi.fn()
    const bereitstellen = erstelleBereitsteller({ anlegen, onAngelegt: () => {} })

    await expect(bereitstellen('a1')).resolves.toBe('a1')
    expect(anlegen).not.toHaveBeenCalled()
  })

  it('creates the record when there is only the placeholder', async () => {
    const anlegen = vi.fn(async () => entwurf('a1'))
    const onAngelegt = vi.fn()
    const bereitstellen = erstelleBereitsteller({ anlegen, onAngelegt })

    await expect(bereitstellen(NEU)).resolves.toBe('a1')
    expect(anlegen).toHaveBeenCalledTimes(1)
    // The page needs telling, so it can cache the draft and swap the address.
    expect(onAngelegt).toHaveBeenCalledWith(entwurf('a1'))
  })

  /* The one that matters. Both blocks in section 7 hold their own useAnlagen,
     and the Fotos picker takes several files at once, so this is asked several
     times within a few milliseconds. Each of those checking and then creating
     would leave a surveyor with two or three empty protocols and their pictures
     scattered over them. */
  it('creates one protocol however many callers ask at once', async () => {
    const { anlegen, freigeben } = gebremst('a1')
    const onAngelegt = vi.fn()
    const bereitstellen = erstelleBereitsteller({ anlegen, onAngelegt })

    const alle = Promise.all([bereitstellen(NEU), bereitstellen(NEU), bereitstellen(NEU)])
    freigeben()

    expect(await alle).toEqual(['a1', 'a1', 'a1'])
    expect(anlegen).toHaveBeenCalledTimes(1)
    expect(onAngelegt).toHaveBeenCalledTimes(1)
  })

  /* Once the automatic save has created the record, the caller passes the real
     id and no second protocol is made. The provider outlives the moment it was
     built in, which is why the id is an argument rather than something it
     remembers. */
  it('notices a record the automatic save created in the meantime', async () => {
    const anlegen = vi.fn(async () => entwurf('erfunden'))
    const bereitstellen = erstelleBereitsteller({ anlegen, onAngelegt: () => {} })

    await expect(bereitstellen('a1')).resolves.toBe('a1')
    expect(anlegen).not.toHaveBeenCalled()
  })

  /* A failed attempt must not poison every later one. The surveyor's next pick
     should try again rather than be handed the same rejection forever. */
  it('lets the next pick try again after a failure', async () => {
    const anlegen = vi
      .fn<() => Promise<Entwurf>>()
      .mockRejectedValueOnce(new Error('Netzwerk weg'))
      .mockResolvedValueOnce(entwurf('a1'))
    const bereitstellen = erstelleBereitsteller({ anlegen, onAngelegt: () => {} })

    await expect(bereitstellen(NEU)).rejects.toThrow('Netzwerk weg')

    await expect(bereitstellen(NEU)).resolves.toBe('a1')
    expect(anlegen).toHaveBeenCalledTimes(2)
  })

  /* The failure travels out rather than being swallowed into a resolved
     placeholder id, which would send the upload at a protocol that is not there
     and report "no such protocol" instead of "the server is unreachable". */
  it('reports a failure to create rather than inventing an id', async () => {
    const bereitstellen = erstelleBereitsteller({
      anlegen: async () => {
        throw new Error('Netzwerk weg')
      },
      onAngelegt: () => {},
    })

    await expect(bereitstellen(NEU)).rejects.toThrow('Netzwerk weg')
  })
})
