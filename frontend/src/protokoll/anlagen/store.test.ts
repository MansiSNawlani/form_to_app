import { beforeEach, describe, expect, it } from 'vitest'
import { createAnlagenStore, type AnlagenSpeicher } from './store'
import type { Anlage } from './typen'

/* A speicher that lives in a Map, so these tests need no browser and no
 * IndexedDB. The store takes its speicher as an argument for exactly this
 * reason: the failure modes worth testing here are a full disk and a database
 * that will not open at all, and both are close to impossible to provoke
 * against a real IndexedDB.
 *
 * The IndexedDB implementation of this interface is verified in the browser
 * instead, on the same footing as browserStorage() in entwurf/store.ts.
 */
class FakeSpeicher implements AnlagenSpeicher {
  private eintraege = new Map<string, { anlage: Anlage; datei: Blob }>()

  /** Set to make every write throw, the way a full disk does. */
  failWrites = false

  /** Set to make every call throw, the way a refused database does. */
  unavailable = false

  private guard() {
    if (this.unavailable) throw new DOMException('blocked', 'InvalidStateError')
  }

  async put(anlage: Anlage, datei: Blob) {
    this.guard()
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError')
    this.eintraege.set(anlage.id, { anlage, datei })
  }

  async remove(id: string) {
    this.guard()
    this.eintraege.delete(id)
  }

  async list(entwurfId: string) {
    this.guard()
    return [...this.eintraege.values()]
      .map((eintrag) => eintrag.anlage)
      .filter((anlage) => anlage.entwurfId === entwurfId)
  }

  async readDatei(id: string) {
    this.guard()
    return this.eintraege.get(id)?.datei
  }
}

function datei(name = 'strecke.jpg', type = 'image/jpeg', bytes = 4) {
  return new File([new Uint8Array(bytes)], name, { type })
}

let speicher: FakeSpeicher
let clock: number

/* Injected rather than read from the system clock: two photographs added in the
 * same millisecond would otherwise make the ordering assertions flaky. */
const now = () => new Date(clock).toISOString()

function store(ids: string[] = ['a-1', 'a-2', 'a-3']) {
  const remaining = [...ids]
  return createAnlagenStore({
    speicher,
    now,
    createId: () => remaining.shift() ?? 'a-erschoepft',
  })
}

beforeEach(() => {
  speicher = new FakeSpeicher()
  clock = Date.parse('2026-09-06T09:00:00.000Z')
})

describe('addAnlage', () => {
  it('stores the file and describes it from what the browser reported', async () => {
    const s = store()

    const ergebnis = await s.addAnlage('e-1', 'FOTO', datei('ufer.jpg', 'image/jpeg', 12))

    expect(ergebnis).toEqual({
      status: 'gespeichert',
      anlage: {
        id: 'a-1',
        entwurfId: 'e-1',
        art: 'FOTO',
        dateiname: 'ufer.jpg',
        mimeType: 'image/jpeg',
        groesse: 12,
        angelegtAm: '2026-09-06T09:00:00.000Z',
      },
    })
  })

  it('reports a full disk instead of throwing, and stores nothing', async () => {
    const s = store()
    speicher.failWrites = true

    const ergebnis = await s.addAnlage('e-1', 'FOTO', datei())

    expect(ergebnis).toEqual({ status: 'fehlgeschlagen', grund: 'voll' })
    expect(await s.listAnlagen('e-1')).toEqual({ status: 'geladen', anlagen: [] })
  })

  /* A full disk and a refused database read the same to a caller that only knows
     the write failed, and they need different messages: one is about the device
     being full, the other about the browser storing nothing at all. */
  it('separates a refused database from a full disk', async () => {
    const s = store()
    speicher.unavailable = true

    const ergebnis = await s.addAnlage('e-1', 'FOTO', datei())

    expect(ergebnis).toEqual({ status: 'fehlgeschlagen', grund: 'nicht_verfuegbar' })
  })
})

describe('listAnlagen', () => {
  it('lists oldest first, so photographs stay in the order they were added', async () => {
    const s = store()
    await s.addAnlage('e-1', 'FOTO', datei('erste.jpg'))
    clock += 60_000
    await s.addAnlage('e-1', 'FOTO', datei('zweite.jpg'))

    const ergebnis = await s.listAnlagen('e-1')

    expect(ergebnis.status).toBe('geladen')
    expect(
      ergebnis.status === 'geladen' && ergebnis.anlagen.map((a) => a.dateiname),
    ).toEqual(['erste.jpg', 'zweite.jpg'])
  })

  it('never returns the attachments of another draft', async () => {
    const s = store()
    await s.addAnlage('e-1', 'FOTO', datei('meine.jpg'))
    await s.addAnlage('e-2', 'FOTO', datei('fremde.jpg'))

    const ergebnis = await s.listAnlagen('e-1')

    expect(
      ergebnis.status === 'geladen' && ergebnis.anlagen.map((a) => a.dateiname),
    ).toEqual(['meine.jpg'])
  })

  /* Not an empty list. The section has to tell "nothing attached yet" from
     "this browser will not store attachments", because only one of those is
     worth showing the surveyor a message about. */
  it('says the store is unavailable rather than pretending it is empty', async () => {
    speicher.unavailable = true

    expect(await store().listAnlagen('e-1')).toEqual({ status: 'nicht_verfuegbar' })
  })
})

describe('removeAnlage', () => {
  it('removes one attachment and leaves the rest', async () => {
    const s = store()
    await s.addAnlage('e-1', 'FOTO', datei('erste.jpg'))
    await s.addAnlage('e-1', 'FOTO', datei('zweite.jpg'))

    expect(await s.removeAnlage('a-1')).toBe(true)

    const ergebnis = await s.listAnlagen('e-1')
    expect(
      ergebnis.status === 'geladen' && ergebnis.anlagen.map((a) => a.dateiname),
    ).toEqual(['zweite.jpg'])
  })

  it('reports failure rather than throwing when the store is unavailable', async () => {
    const s = store()
    speicher.unavailable = true

    expect(await s.removeAnlage('a-1')).toBe(false)
  })
})

describe('readDatei', () => {
  it('reads the stored bytes back', async () => {
    const s = store()
    await s.addAnlage('e-1', 'KARTENAUSSCHNITT', datei('karte.png', 'image/png', 7))

    const blob = await s.readDatei('a-1')

    expect(blob?.size).toBe(7)
  })

  it('returns null for an attachment that is not there', async () => {
    expect(await store().readDatei('a-unbekannt')).toBeNull()
  })

  it('returns null rather than throwing when the store is unavailable', async () => {
    speicher.unavailable = true

    expect(await store().readDatei('a-1')).toBeNull()
  })
})
