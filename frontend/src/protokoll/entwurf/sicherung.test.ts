import { beforeEach, describe, expect, it } from 'vitest'
import { memoryStorage } from './browserSpeicher'
import { KEY_PREFIX, createSicherungsStore, gleicheAntworten } from './sicherung'

/* A Storage that behaves is the shared memoryStorage, the same stand-in the app
   itself falls back to. The one that refuses everything is here, because nothing
   in the app wants it: it is what a private window and a locked-down profile
   actually do, throwing on the accessor rather than returning null. */
function kaputteStorage(): Storage {
  const werfen = () => {
    throw new DOMException('storage is blocked')
  }
  return {
    get length(): number {
      return werfen()
    },
    key: werfen,
    getItem: werfen,
    setItem: werfen,
    removeItem: werfen,
    clear: werfen,
  }
}

const JETZT = '2026-09-09T10:15:00.000Z'

let storage: Storage
let store: ReturnType<typeof createSicherungsStore>

beforeEach(() => {
  storage = memoryStorage()
  store = createSicherungsStore({ storage, now: () => JETZT })
})

describe('createSicherungsStore', () => {
  it('keeps a copy under the protocol id and reads it back', () => {
    store.schreib({ id: 'a1', version: 3, antworten: { anlass: 'wrrl' } })

    expect(store.lies('a1')).toEqual({
      id: 'a1',
      version: 3,
      antworten: { anlass: 'wrrl' },
      zeitpunkt: JETZT,
    })
  })

  /* The moment is stamped here rather than by the caller, so no component can
     keep a copy and leave it claiming it was kept an hour ago. */
  it('stamps the moment itself', () => {
    store.schreib({ id: 'a1', version: 1, antworten: {} })

    expect(store.lies('a1')?.zeitpunkt).toBe(JETZT)
  })

  it('knows nothing about a protocol it has no copy of', () => {
    expect(store.lies('unbekannt')).toBeNull()
  })

  it('keeps one protocol per key rather than one copy for all of them', () => {
    store.schreib({ id: 'a1', version: 1, antworten: { anlass: 'wrrl' } })
    store.schreib({ id: 'b2', version: 1, antworten: { anlass: 'ffh' } })

    expect(store.lies('a1')?.antworten).toEqual({ anlass: 'wrrl' })
    expect(store.lies('b2')?.antworten).toEqual({ anlass: 'ffh' })
  })

  it('forgets a copy once it is deleted', () => {
    store.schreib({ id: 'a1', version: 1, antworten: {} })
    store.loesche('a1')

    expect(store.lies('a1')).toBeNull()
  })

  /* A killed tab can leave half a value behind, and an older shape of this code
     can leave a whole one that no longer fits. Both mean the same thing as no
     copy at all: there is nothing here worth offering back. */
  it('treats an unreadable value as no copy', () => {
    storage.setItem(KEY_PREFIX + 'a1', '{ das ist kein json')

    expect(store.lies('a1')).toBeNull()
  })

  it('treats a value of the wrong shape as no copy', () => {
    storage.setItem(KEY_PREFIX + 'a1', JSON.stringify({ id: 'a1', antworten: {} }))

    expect(store.lies('a1')).toBeNull()
  })

  /* Storage that throws on the accessor itself is what a private window and a
     blocked-site-data setting produce. Saving must still be attempted: the copy
     is a safety net, and a missing net is no reason not to jump. */
  it('survives storage that refuses everything', () => {
    const kaputt = createSicherungsStore({ storage: kaputteStorage(), now: () => JETZT })

    expect(() => kaputt.schreib({ id: 'a1', version: 1, antworten: {} })).not.toThrow()
    expect(() => kaputt.loesche('a1')).not.toThrow()
    expect(kaputt.lies('a1')).toBeNull()
  })
})

describe('gleicheAntworten', () => {
  it('sees two empty documents as the same', () => {
    expect(gleicheAntworten({}, {})).toBe(true)
  })

  /* The reason this is not JSON.stringify. React Hook Form hands its keys back
     in registration order, the server in storage order, so identical documents
     would compare as different and the restore offer would appear after every
     single save. */
  it('ignores the order the keys arrive in', () => {
    const a = { anlass: 'wrrl', messdaten: { temperatur: '12', sichttiefe: '30' } }
    const b = { messdaten: { sichttiefe: '30', temperatur: '12' }, anlass: 'wrrl' }

    expect(gleicheAntworten(a, b)).toBe(true)
  })

  /* An untouched group comes back from React Hook Form as undefined, while the
     server, never having been told about it, simply has no key. Nothing was
     typed either way. */
  it('treats an undefined value and a missing key as the same', () => {
    expect(gleicheAntworten({ anlass: 'wrrl', ufer: undefined }, { anlass: 'wrrl' })).toBe(true)
  })

  it('spots a changed answer', () => {
    expect(gleicheAntworten({ anlass: 'wrrl' }, { anlass: 'ffh' })).toBe(false)
  })

  it('spots an answer added deeper in', () => {
    expect(
      gleicheAntworten({ messdaten: { temperatur: '12' } }, { messdaten: { temperatur: '13' } }),
    ).toBe(false)
  })

  /* Cleared and never touched are different states of the form, and only one of
     them is worth offering to restore. */
  it('tells a cleared answer from an untouched one', () => {
    expect(gleicheAntworten({ anlass: '' }, {})).toBe(false)
  })

  it('spots an answer the other document does not have at all', () => {
    expect(gleicheAntworten({ anlass: 'wrrl' }, { anlass: 'wrrl', datum: '2026-09-09' })).toBe(false)
  })
})
