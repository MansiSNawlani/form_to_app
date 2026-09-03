import { describe, expect, it } from 'vitest'
import { bewerteBlock, pruefeProzentbloecke } from './prozent'
import {
  PROZENTBLOECKE,
  SUBSTRAT,
  UFERNEIGUNG,
  UMLAND,
  type Prozentblock,
} from '../abschnitte/teil3/bloecke'
import type { Antworten } from '../entwurf/typen'

/* The sum-to-100 rule, checked against all six blocks rather than one.
 *
 * Defect 1 in docs/ffs-defect-list.md is precisely a rule that was applied to
 * five blocks and quietly not to the sixth, and it put wrong data into FiaKa for
 * years. A test that only exercised Umland would let exactly that back in, so
 * every case below runs over PROZENTBLOECKE. */

type Werte = Record<string, Record<string, string>>

function mitWerten(block: Prozentblock, werte: readonly (string | undefined)[]): Antworten {
  const antworten: Werte = {}

  block.felder.forEach(({ pfad }, index) => {
    const wert = werte[index]
    if (wert === undefined) return
    const [gruppe, feld] = pfad.split('.')
    antworten[gruppe] ??= {}
    antworten[gruppe][feld] = wert
  })

  return antworten as Antworten
}

/** Whole shares adding up to gesamt, with the remainder on the first. */
function anteile(anzahl: number, gesamt: number): string[] {
  const je = Math.floor(gesamt / anzahl)
  const rest = gesamt - je * anzahl
  return Array.from({ length: anzahl }, (_, index) => String(index === 0 ? je + rest : je))
}

function verteilt(block: Prozentblock, gesamt: number): Antworten {
  return mitWerten(block, anteile(block.felder.length, gesamt))
}

const jederBlock = PROZENTBLOECKE.map((block) => [block.id, block] as const)

describe('bewerteBlock', () => {
  it.each(jederBlock)('%s: ein leerer Block sagt nichts', (_id, block) => {
    const { summe, verstoesse } = bewerteBlock(block, {})
    expect(summe).toBe(0)
    expect(verstoesse).toEqual([])
  })

  it.each(jederBlock)('%s: genau 100 ist richtig', (_id, block) => {
    const { summe, verstoesse } = bewerteBlock(block, verteilt(block, 100))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })

  it.each(jederBlock)('%s: 83 ist zu wenig', (_id, block) => {
    const { summe, verstoesse } = bewerteBlock(block, verteilt(block, 83))
    expect(summe).toBe(83)
    expect(verstoesse).toEqual([
      { pfad: block.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it.each(jederBlock)('%s: 120 ist zu viel', (_id, block) => {
    const { summe, verstoesse } = bewerteBlock(block, verteilt(block, 120))
    expect(summe).toBe(120)
    expect(verstoesse).toEqual([
      { pfad: block.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  /* One share carrying the whole hundred is the normal answer for a bank that
     is entirely one thing. The blanks beside it are not missing answers. */
  it.each(jederBlock)('%s: ein leerer Anteil zaehlt als 0', (_id, block) => {
    const { summe, verstoesse } = bewerteBlock(block, mitWerten(block, ['100']))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })

  it.each([
    ['eine Kommazahl', '50.5'],
    ['eine deutsche Kommazahl', '50,5'],
    ['eine negative Zahl', '-1'],
    ['mehr als 100', '101'],
    ['Text', 'abc'],
  ])('%s meldet sich am eigenen Feld', (_name, wert) => {
    const { verstoesse } = bewerteBlock(UMLAND, mitWerten(UMLAND, [wert]))
    expect(verstoesse).toEqual([
      {
        pfad: UMLAND.felder[0].pfad,
        schluessel: 'protokoll.regeln.prozentKeineGanzeZahl',
      },
    ])
  })

  /* A block holding something that is not a number has no total worth
     complaining about, and two messages for one mistake is noise. */
  it('unterdrueckt die Summenmeldung, solange ein Anteil keine Zahl ist', () => {
    const { verstoesse } = bewerteBlock(UMLAND, mitWerten(UMLAND, ['abc', '10']))
    expect(verstoesse).toHaveLength(1)
    expect(verstoesse[0].schluessel).toBe('protokoll.regeln.prozentKeineGanzeZahl')
  })

  it('zaehlt 0 als gegebene Antwort und nicht als leer', () => {
    const { summe, verstoesse } = bewerteBlock(UMLAND, mitWerten(UMLAND, ['0']))
    expect(summe).toBe(0)
    expect(verstoesse).toEqual([
      { pfad: UMLAND.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it('ignoriert Leerzeichen um einen Anteil', () => {
    const { summe, verstoesse } = bewerteBlock(UMLAND, mitWerten(UMLAND, [' 100 ']))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })
})

describe('pruefeProzentbloecke', () => {
  it('sagt zu einem leeren Entwurf nichts', () => {
    expect(pruefeProzentbloecke({})).toEqual([])
  })

  /* Defect 1 in docs/ffs-defect-list.md, named on its own so it cannot be
     dropped by accident. The legacy form maintains check_ok_substrat as the user
     types and never reads it at submit, so a substrate distribution totalling 43
     is sent and accepted. */
  it('prueft die Substratverteilung wie jeden anderen Block', () => {
    const verstoesse = pruefeProzentbloecke(verteilt(SUBSTRAT, 43))
    expect(verstoesse).toEqual([
      { pfad: 'summe.substrat', schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it('meldet jeden falschen Block einzeln', () => {
    const antworten = {
      ...verteilt(UMLAND, 83),
      ...verteilt(SUBSTRAT, 120),
    }
    const pfade = pruefeProzentbloecke(antworten).map(({ pfad }) => pfad)
    expect(pfade).toEqual(['summe.umland', 'summe.substrat'])
  })

  it('laesst die anderen Bloecke in Ruhe, wenn einer falsch ist', () => {
    const verstoesse = pruefeProzentbloecke(verteilt(UMLAND, 83))
    expect(verstoesse).toHaveLength(1)
    expect(verstoesse[0].pfad).toBe('summe.umland')
  })

  /* The three ufer blocks share a group in the answers document, so a value in
     one is a sibling of a value in another. Nothing may leak across. */
  it('haelt die drei Ufer-Bloecke auseinander', () => {
    const verstoesse = pruefeProzentbloecke(verteilt(UFERNEIGUNG, 50))
    expect(verstoesse).toEqual([
      { pfad: 'summe.neigung', schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })
})
