import { zodResolver } from '@hookform/resolvers/zod'
import { describe, expect, it } from 'vitest'
import { antwortenSchema } from './schema'
import type { Antworten } from '../entwurf/typen'

/* summe.umland names no field in the answers document, so whether the resolver
   carries an issue raised there into the error tree is not obvious. It does. If
   it ever started filtering issues against the document instead, six messages
   would vanish in silence. */

const aufloesen = zodResolver(antwortenSchema)

async function fehlerFuer(antworten: Antworten) {
  const { errors } = await aufloesen(antworten, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  })
  return errors as Record<string, Record<string, { message?: string } | undefined> | undefined>
}

describe('antwortenSchema', () => {
  it('legt die Meldung eines Blocks unter dem Pfad des Blocks ab', async () => {
    const errors = await fehlerFuer({ umland: { nadelwald: '83' } })

    expect(errors.summe?.umland?.message).toBe('protokoll.regeln.prozentsummeNichtHundert')
  })

  /* The whole point of giving a block its own path. A wrong total is one
     mistake, so the eight boxes under it stay clean. */
  it('faerbt kein einzelnes Feld ein, wenn nur die Summe falsch ist', async () => {
    const errors = await fehlerFuer({ umland: { nadelwald: '83' } })

    expect(errors.umland).toBeUndefined()
  })

  it('meldet einen unmoeglichen Anteil weiterhin am Feld selbst', async () => {
    const errors = await fehlerFuer({ umland: { nadelwald: 'abc' } })

    expect(errors.umland?.nadelwald?.message).toBe('protokoll.regeln.prozentKeineGanzeZahl')
    expect(errors.summe).toBeUndefined()
  })

  /* Part 6's table message is the second path outside the answers document, so
     the same guard applies to it: a resolver that ever started filtering issues
     against the document would make it vanish in silence. */
  it('legt die Meldung der Fangtabelle unter tabelle.arten ab', async () => {
    const errors = await fehlerFuer({ arten: { art1: { name: 'HECH', klasse_1: '0' } } })

    expect(errors.tabelle?.arten?.message).toBe('protokoll.regeln.fangOhneNachweisCode')
  })

  it('faerbt keine Zelle ein, wenn nur die Tabelle als Ganzes falsch ist', async () => {
    const errors = await fehlerFuer({ arten: { art1: { name: 'HECH', klasse_1: '0' } } })

    expect(errors.arten).toBeUndefined()
  })

  it('meldet eine unmoegliche Anzahl weiterhin an der Zelle selbst', async () => {
    const errors = await fehlerFuer({ arten: { art1: { klasse_1: '-4' } } })
    const zeile = errors.arten?.art1 as unknown as Record<string, { message?: string }>

    expect(zeile.klasse_1.message).toBe('protokoll.regeln.anzahlKeineGanzeZahl')
    expect(errors.tabelle).toBeUndefined()
  })

  it('sagt zu einem leeren Entwurf nichts', async () => {
    expect(await fehlerFuer({})).toEqual({})
  })
})
