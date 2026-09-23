import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../entwurf/browserSpeicher'
import { KEY_PREFIX, createBerichtstore, type Einlesebericht } from './bericht'

/* Same arrangement as absenden/gemerkt.test.ts: the storage and the clock are
   handed in, so these need no browser and the failure modes below can be
   provoked rather than described. */
function store(storage: Storage = memoryStorage(), zeit = '2026-09-23T09:00:00.000Z') {
  return createBerichtstore({ storage, now: () => zeit })
}

const BERICHT: Einlesebericht = {
  quellversion: '20230225',
  unbrauchbar: ['datum'],
  bilder: 1,
}

/* A storage whose every accessor throws, which is what a private window, a
   locked-down profile and a blocked-site-data setting all look like. */
function kaputterSpeicher(): Storage {
  const werfen = () => {
    throw new DOMException('storage is not available')
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
  } as unknown as Storage
}

describe('createBerichtstore', () => {
  it('reads back what it wrote', () => {
    const s = store()

    s.schreib('p1', BERICHT)

    expect(s.lies('p1')).toEqual({
      id: 'p1',
      zeitpunkt: '2026-09-23T09:00:00.000Z',
      quellversion: '20230225',
      unbrauchbar: ['datum'],
      bilder: 1,
      bannerGelesen: false,
    })
  })

  it('has nothing to say about a protocol that was never imported', () => {
    expect(store().lies('p1')).toBeNull()
  })

  /* Otherwise every clean import leaves a banner saying nothing went wrong, on
     every reload, forever. The arrival banner is drawn from a report existing,
     so an empty report and no report have to be the same thing. */
  it('stores nothing for an import with nothing to report', () => {
    const storage = memoryStorage()
    const s = store(storage)

    s.schreib('p1', { quellversion: '20260609', unbrauchbar: [], bilder: 0 })

    expect(s.lies('p1')).toBeNull()
    expect(storage.getItem(KEY_PREFIX + 'p1')).toBeNull()
  })

  it('keeps a report that has only pictures to report', () => {
    const s = store()

    s.schreib('p1', { quellversion: '20260609', unbrauchbar: [], bilder: 4 })

    expect(s.lies('p1')?.bilder).toBe(4)
  })

  describe('marking the banner read', () => {
    /* The whole point of the store. Dismissing an explanation must not destroy
       the record of work still outstanding. */
    it('leaves the unusable answers and the picture count alone', () => {
      const s = store()
      s.schreib('p1', BERICHT)

      s.bannerGelesen('p1')

      const gemerkt = s.lies('p1')
      expect(gemerkt?.bannerGelesen).toBe(true)
      expect(gemerkt?.unbrauchbar).toEqual(['datum'])
      expect(gemerkt?.bilder).toBe(1)
    })

    it('does nothing for a protocol that was never imported', () => {
      const s = store()

      expect(() => s.bannerGelesen('p1')).not.toThrow()
      expect(s.lies('p1')).toBeNull()
    })
  })

  describe('one protocol never touches another', () => {
    it('keeps reports apart', () => {
      const s = store()

      s.schreib('p1', BERICHT)
      s.schreib('p2', { quellversion: '20260609', unbrauchbar: ['uhrzeit'], bilder: 0 })
      s.bannerGelesen('p1')

      expect(s.lies('p1')?.unbrauchbar).toEqual(['datum'])
      expect(s.lies('p2')?.unbrauchbar).toEqual(['uhrzeit'])
      expect(s.lies('p2')?.bannerGelesen).toBe(false)
    })
  })

  describe('a stored value is only trustworthy as far as it has been checked', () => {
    it('reads unparseable content as nothing', () => {
      const storage = memoryStorage()
      storage.setItem(KEY_PREFIX + 'p1', '{halb geschrieben')

      expect(store(storage).lies('p1')).toBeNull()
    })

    it('reads a value missing a field as nothing', () => {
      const storage = memoryStorage()
      storage.setItem(KEY_PREFIX + 'p1', JSON.stringify({ id: 'p1', bilder: 2 }))

      expect(store(storage).lies('p1')).toBeNull()
    })

    /* An older shape of this code wrote no bannerGelesen. Unread is the safe
       reading: the banner shows once more rather than never. */
    it('treats a value written before the banner flag existed as unread', () => {
      const storage = memoryStorage()
      storage.setItem(
        KEY_PREFIX + 'p1',
        JSON.stringify({
          id: 'p1',
          zeitpunkt: '2026-09-22T09:00:00.000Z',
          quellversion: '20240115',
          unbrauchbar: ['datum'],
          bilder: 0,
        }),
      )

      expect(store(storage).lies('p1')?.bannerGelesen).toBe(false)
    })

    it('drops a bad path rather than the whole report', () => {
      const storage = memoryStorage()
      storage.setItem(
        KEY_PREFIX + 'p1',
        JSON.stringify({
          id: 'p1',
          zeitpunkt: '2026-09-23T09:00:00.000Z',
          quellversion: '20230225',
          unbrauchbar: ['datum', 42, null, 'uhrzeit'],
          bilder: 1,
          bannerGelesen: false,
        }),
      )

      expect(store(storage).lies('p1')?.unbrauchbar).toEqual(['datum', 'uhrzeit'])
    })
  })

  describe('a browser that will not store anything', () => {
    /* The protocol is on the server with its answers in it either way, which is
       the part that matters. A storage that throws must not break the import the
       person just did. */
    it('breaks nothing on write', () => {
      const s = store(kaputterSpeicher())

      expect(() => s.schreib('p1', BERICHT)).not.toThrow()
    })

    it('breaks nothing on read', () => {
      const s = store(kaputterSpeicher())

      expect(s.lies('p1')).toBeNull()
    })

    it('breaks nothing when the banner is dismissed', () => {
      const s = store(kaputterSpeicher())

      expect(() => s.bannerGelesen('p1')).not.toThrow()
    })
  })
})
