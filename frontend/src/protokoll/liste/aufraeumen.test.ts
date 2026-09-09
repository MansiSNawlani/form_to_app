import { describe, expect, it, vi } from 'vitest'
import { raeumeBrowserAuf } from './aufraeumen'
import type { Anlage } from '../anlagen/typen'

function anlage(id: string): Anlage {
  return {
    id,
    entwurfId: 'a1',
    art: 'FOTO',
    dateiname: `${id}.jpg`,
    mimeType: 'image/jpeg',
    groesse: 1000,
    angelegtAm: '2026-09-09T08:00:00Z',
  }
}

function stores(anlagen: Anlage[] = []) {
  return {
    sicherungen: { loesche: vi.fn() },
    anlagen: {
      listAnlagen: vi.fn(async () => ({ status: 'loaded' as const, anlagen })),
      removeAnlage: vi.fn(async (_id: string) => true),
    },
  }
}

describe('raeumeBrowserAuf', () => {
  it('drops the safety copy and every attachment of that draft', async () => {
    const store = stores([anlage('f1'), anlage('f2')])

    await raeumeBrowserAuf('a1', store)

    expect(store.sicherungen.loesche).toHaveBeenCalledWith('a1')
    expect(store.anlagen.listAnlagen).toHaveBeenCalledWith('a1')
    expect(store.anlagen.removeAnlage.mock.calls.map(([id]) => id)).toEqual(['f1', 'f2'])
  })

  /* Nothing else will ever come back for these. Once the protocol is gone from
     the server there is no screen that lists its attachments, so a file left
     behind here would sit in the browser's database for good. */
  it('is happy with a draft that had no attachments', async () => {
    const store = stores()

    await raeumeBrowserAuf('a1', store)

    expect(store.anlagen.removeAnlage).not.toHaveBeenCalled()
  })

  /* Best effort by design. The protocol is already gone from the server by the
     time this runs, so a browser that will not open its own database must not
     turn a completed delete into a failure message. */
  it('does not throw when the attachment database cannot be read', async () => {
    const store = stores()
    store.anlagen.listAnlagen.mockResolvedValue({
      status: 'unavailable' as never,
      anlagen: [],
    })

    await expect(raeumeBrowserAuf('a1', store)).resolves.toBeUndefined()
    expect(store.anlagen.removeAnlage).not.toHaveBeenCalled()
  })

  it('does not throw when removing one of them fails', async () => {
    const store = stores([anlage('f1')])
    store.anlagen.removeAnlage.mockRejectedValue(new Error('kaputt'))

    await expect(raeumeBrowserAuf('a1', store)).resolves.toBeUndefined()
  })
})
