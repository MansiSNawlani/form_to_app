import { zodResolver } from '@hookform/resolvers/zod'
import { describe, expect, it } from 'vitest'
import { antwortenSchema } from './schema'
import type { Antworten } from '../entwurf/typen'

/* The block message has to survive the trip from the rule to React Hook Form's
   error tree, and that trip is the one thing about it that is not obvious.
 *
 * A block's path, summe.umland, names no field in the answers document. Zod
 * raises the issue at ['summe', 'umland'] and the resolver turns every issue
 * path into a nested error object, so the question is whether it does that
 * faithfully for a path with nothing behind it in the values. It does, and this
 * test is what keeps it that way: if the resolver ever started filtering issues
 * against the document, six messages would vanish silently and section 3 would
 * simply stop objecting to a wrong total. */

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
