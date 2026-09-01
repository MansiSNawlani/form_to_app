import { beforeEach, describe, expect, it } from 'vitest'
import { createEntwurfStore, KEY_PREFIX } from './store'
import { FORM_VERSION } from './typen'

/* A Storage that lives in a Map, so these tests need no browser environment.
 * The store takes its storage as an argument for exactly this reason: the
 * failure modes worth testing here (corrupt data, a full quota, blocked site
 * data) are all awkward to provoke against a real localStorage. */
class FakeStorage implements Storage {
  private entries = new Map<string, string>()

  /** Set to make every write throw, the way a full quota does. */
  failWrites = false

  get length() {
    return this.entries.size
  }

  key(index: number) {
    return [...this.entries.keys()][index] ?? null
  }

  getItem(key: string) {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError')
    this.entries.set(key, value)
  }

  removeItem(key: string) {
    this.entries.delete(key)
  }

  clear() {
    this.entries.clear()
  }
}

let storage: FakeStorage
let clock: number

/* Injected rather than read from the system clock, because two drafts created in
 * the same millisecond would otherwise make the ordering assertions flaky. */
const now = () => new Date(clock).toISOString()

function store(ids: string[] = ['id-1', 'id-2', 'id-3']) {
  const remaining = [...ids]
  return createEntwurfStore({
    storage,
    now,
    createId: () => remaining.shift() ?? 'id-exhausted',
  })
}

beforeEach(() => {
  storage = new FakeStorage()
  clock = Date.parse('2026-09-01T10:00:00.000Z')
})

describe('createEntwurf', () => {
  it('creates a draft that can be read back', () => {
    const s = store()
    const entwurf = s.createEntwurf()

    expect(entwurf.id).toBe('id-1')
    expect(entwurf.formVersion).toBe(FORM_VERSION)
    expect(entwurf.antworten).toEqual({})
    expect(s.readEntwurf('id-1')).toEqual(entwurf)
  })

  it('still returns a usable draft when storage refuses the write', () => {
    storage.failWrites = true
    const s = store()

    const entwurf = s.createEntwurf()

    // The session keeps working; the draft simply will not survive a reload.
    expect(entwurf.id).toBe('id-1')
    expect(s.readEntwurf('id-1')).toBeNull()
  })
})

describe('readEntwurf', () => {
  it('returns null for a draft that does not exist', () => {
    expect(store().readEntwurf('unbekannt')).toBeNull()
  })

  it('returns null rather than throwing on corrupt stored data', () => {
    storage.setItem(`${KEY_PREFIX}kaputt`, '{not really json')

    expect(store().readEntwurf('kaputt')).toBeNull()
  })

  it('returns null for valid JSON that is not a draft', () => {
    storage.setItem(`${KEY_PREFIX}fremd`, JSON.stringify({ id: 42 }))

    expect(store().readEntwurf('fremd')).toBeNull()
  })
})

describe('writeEntwurf', () => {
  it('persists the answers and moves geaendertAm forward', () => {
    const s = store()
    const entwurf = s.createEntwurf()

    clock += 60_000
    const result = s.writeEntwurf({ ...entwurf, antworten: { anlass: 'wrrl' } })

    expect(result.status).toBe('saved')
    expect(result.entwurf.geaendertAm).toBe('2026-09-01T10:01:00.000Z')
    expect(result.entwurf.angelegtAm).toBe(entwurf.angelegtAm)
    expect(s.readEntwurf('id-1')?.antworten.anlass).toBe('wrrl')
  })

  it('reports failure instead of throwing when storage is full', () => {
    const s = store()
    const entwurf = s.createEntwurf()
    storage.failWrites = true

    const result = s.writeEntwurf({ ...entwurf, antworten: { anlass: 'ffh' } })

    expect(result.status).toBe('failed')
    // The caller still gets the draft back, so the value stays on screen.
    expect(result.entwurf.antworten.anlass).toBe('ffh')
    expect(s.readEntwurf('id-1')?.antworten.anlass).toBeUndefined()
  })
})

describe('listEntwuerfe', () => {
  it('lists drafts most recently changed first', () => {
    const s = store()
    const erster = s.createEntwurf()
    clock += 60_000
    s.createEntwurf()
    clock += 60_000
    s.writeEntwurf(erster)

    expect(s.listEntwuerfe().map((e) => e.id)).toEqual(['id-1', 'id-2'])
  })

  it('ignores keys belonging to anything else', () => {
    storage.setItem('ffs-locale', 'de')
    storage.setItem(`${KEY_PREFIX}kaputt`, 'not json')
    const s = store()
    s.createEntwurf()

    expect(s.listEntwuerfe().map((e) => e.id)).toEqual(['id-1'])
  })
})
