import felder from '@formular/felder.json'
import { describe, expect, it } from 'vitest'
import {
  UFERNEIGUNG,
  PROZENTGRUPPEN,
  SOHLVERBAUUNG,
  SUBSTRAT,
  UFERBEWUCHS,
  UFERVERBAUUNG,
  UMLAND,
} from './gruppen'

/* Forty-three field paths are transcribed by hand into gruppen.ts, and every one
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

describe('die Prozentgruppen von Teil 3', () => {
  it.each([
    ['Umland', UMLAND],
    ['Neigung', UFERNEIGUNG],
    ['Uferbewuchs', UFERBEWUCHS],
    ['Uferverbauung', UFERVERBAUUNG],
    ['Substrat', SUBSTRAT],
    ['Sohlverbauung', SOHLVERBAUUNG],
  ])('%s benennt nur Felder, die es im Formular gibt', (_name, gruppe) => {
    for (const { pfad } of gruppe.felder) {
      expect(NAMEN, pfad).toContain(pfad)
    }
  })

  /* The counts are the printed form's, read off page 2. They are here because a
     gruppe that quietly loses an entry still renders and still adds up; it just
     adds up to less than 100 forever, and the sum rule would then be
     enforcing the wrong total. */
  it('haelt die Anzahl der Anteile je Gruppe', () => {
    expect(UMLAND.felder).toHaveLength(8)
    expect(UFERNEIGUNG.felder).toHaveLength(4)
    expect(UFERBEWUCHS.felder).toHaveLength(9)
    expect(UFERVERBAUUNG.felder).toHaveLength(8)
    expect(SUBSTRAT.felder).toHaveLength(8)
    expect(SOHLVERBAUUNG.felder).toHaveLength(6)
  })

  it('nennt jedes Feld genau einmal', () => {
    const pfade = PROZENTGRUPPEN.flatMap((gruppe) => gruppe.felder.map(({ pfad }) => pfad))
    expect(new Set(pfade).size).toBe(pfade.length)
  })

  it('umfasst sechs Gruppen', () => {
    expect(PROZENTGRUPPEN).toHaveLength(6)
  })

  it('gibt jeder Gruppe eine eigene Kennung', () => {
    const kennungen = PROZENTGRUPPEN.map((gruppe) => gruppe.id)
    expect(new Set(kennungen).size).toBe(kennungen.length)
  })

  /* The guard on the summe prefix. A group's id addresses its message, and
     React Hook Form would happily hang that message on a real field if the two
     ever named the same path. ufer.neigung is the near miss: it is the
     geschuetteter Damm's slope in degrees, and the Neigung gruppe sits directly
     above it. */
  it('benennt keine Gruppe wie ein Formularfeld', () => {
    for (const { id } of PROZENTGRUPPEN) {
      expect(NAMEN, id).not.toContain(id)
    }
  })
})
