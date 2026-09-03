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

  it('sagt zu einem leeren Entwurf nichts', async () => {
    expect(await fehlerFuer({})).toEqual({})
  })
})
