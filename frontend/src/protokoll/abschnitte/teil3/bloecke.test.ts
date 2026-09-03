import felder from '@formular/felder.json'
import { describe, expect, it } from 'vitest'
import {
  UFERNEIGUNG,
  PROZENTBLOECKE,
  SOHLVERBAUUNG,
  SUBSTRAT,
  UFERBEWUCHS,
  UFERVERBAUUNG,
  UMLAND,
} from './bloecke'

/* Forty-three field paths are transcribed by hand into bloecke.ts, and every one
   has to match the legacy PDF exactly. coding-standards.md makes that match the
   thing that keeps the eventual FiaKa transfer a direct mapping rather than a
   lookup table somebody maintains.

   A misspelling is invisible in the running app: the field renders, accepts a
   number and saves it. It would surface years later as a column FiaKa cannot
   fill. felder.json is the extracted record of the real form, so it is what the
   paths are checked against.

   TypeScript already covers the other direction. The entries are typed
   AntwortPfad, so a path that is not in the answers document is a build error. */

const NAMEN = new Set(felder.felder.map((feld) => feld.name))

describe('die Prozentbloecke von Teil 3', () => {
  it.each([
    ['Umland', UMLAND],
    ['Neigung', UFERNEIGUNG],
    ['Uferbewuchs', UFERBEWUCHS],
    ['Uferverbauung', UFERVERBAUUNG],
    ['Substrat', SUBSTRAT],
    ['Sohlverbauung', SOHLVERBAUUNG],
  ])('%s benennt nur Felder, die es im Formular gibt', (_name, block) => {
    for (const { pfad } of block.felder) {
      expect(NAMEN, pfad).toContain(pfad)
    }
  })

  /* The counts are the printed form's, read off page 2. They are here because a
     block that quietly loses an entry still renders and still adds up; it just
     adds up to less than 100 forever, and the sum rule would then be
     enforcing the wrong total. */
  it('haelt die Anzahl der Anteile je Block', () => {
    expect(UMLAND.felder).toHaveLength(8)
    expect(UFERNEIGUNG.felder).toHaveLength(4)
    expect(UFERBEWUCHS.felder).toHaveLength(9)
    expect(UFERVERBAUUNG.felder).toHaveLength(8)
    expect(SUBSTRAT.felder).toHaveLength(8)
    expect(SOHLVERBAUUNG.felder).toHaveLength(6)
  })

  it('nennt jedes Feld genau einmal', () => {
    const pfade = PROZENTBLOECKE.flatMap((block) => block.felder.map(({ pfad }) => pfad))
    expect(new Set(pfade).size).toBe(pfade.length)
  })

  it('umfasst sechs Bloecke', () => {
    expect(PROZENTBLOECKE).toHaveLength(6)
  })

  it('gibt jedem Block eine eigene Kennung', () => {
    const kennungen = PROZENTBLOECKE.map((block) => block.id)
    expect(new Set(kennungen).size).toBe(kennungen.length)
  })

  /* The guard on the summe prefix. A block's id addresses its message, and
     React Hook Form would happily hang that message on a real field if the two
     ever named the same path. ufer.neigung is the near miss: it is the
     geschuetteter Damm's slope in degrees, and the Neigung block sits directly
     above it. */
  it('benennt keinen Block wie ein Formularfeld', () => {
    for (const { id } of PROZENTBLOECKE) {
      expect(NAMEN, id).not.toContain(id)
    }
  })
})
