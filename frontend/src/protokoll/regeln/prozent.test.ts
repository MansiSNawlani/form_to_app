import { describe, expect, it } from 'vitest'
import { bewerteGruppe, pruefeProzentgruppen } from './prozent'
import {
  PROZENTGRUPPEN,
  SUBSTRAT,
  UFERNEIGUNG,
  UMLAND,
  type Prozentgruppe,
} from '../abschnitte/teil3/gruppen'
import type { Antworten } from '../entwurf/typen'

/* Every case runs over all six groups. Defect 1 was a rule applied to five
   groups and quietly not to the sixth, so a suite that exercised one group
   would be blind to the thing this rule exists to prevent. */

type Werte = Record<string, Record<string, string>>

function mitWerten(gruppe: Prozentgruppe, werte: readonly (string | undefined)[]): Antworten {
  const antworten: Werte = {}

  gruppe.felder.forEach(({ pfad }, index) => {
    const wert = werte[index]
    if (wert === undefined) return
    const [wurzel, feld] = pfad.split('.')
    antworten[wurzel] ??= {}
    antworten[wurzel][feld] = wert
  })

  return antworten as Antworten
}

/** Whole shares adding up to gesamt, with the remainder on the first. */
function anteile(anzahl: number, gesamt: number): string[] {
  const je = Math.floor(gesamt / anzahl)
  const rest = gesamt - je * anzahl
  return Array.from({ length: anzahl }, (_, index) => String(index === 0 ? je + rest : je))
}

function verteilt(gruppe: Prozentgruppe, gesamt: number): Antworten {
  return mitWerten(gruppe, anteile(gruppe.felder.length, gesamt))
}

const jedeGruppe = PROZENTGRUPPEN.map((gruppe) => [gruppe.id, gruppe] as const)

describe('bewerteGruppe', () => {
  it.each(jedeGruppe)('%s: eine leere Gruppe sagt nichts', (_id, gruppe) => {
    const { summe, verstoesse } = bewerteGruppe(gruppe, {})
    expect(summe).toBe(0)
    expect(verstoesse).toEqual([])
  })

  it.each(jedeGruppe)('%s: genau 100 ist richtig', (_id, gruppe) => {
    const { summe, verstoesse } = bewerteGruppe(gruppe, verteilt(gruppe, 100))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })

  it.each(jedeGruppe)('%s: 83 ist zu wenig', (_id, gruppe) => {
    const { summe, verstoesse } = bewerteGruppe(gruppe, verteilt(gruppe, 83))
    expect(summe).toBe(83)
    expect(verstoesse).toEqual([
      { pfad: gruppe.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it.each(jedeGruppe)('%s: 120 ist zu viel', (_id, gruppe) => {
    const { summe, verstoesse } = bewerteGruppe(gruppe, verteilt(gruppe, 120))
    expect(summe).toBe(120)
    expect(verstoesse).toEqual([
      { pfad: gruppe.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  /* One share carrying the whole hundred is the normal answer for a bank that
     is entirely one thing. The blanks beside it are not missing answers. */
  it.each(jedeGruppe)('%s: ein leerer Anteil zaehlt als 0', (_id, gruppe) => {
    const { summe, verstoesse } = bewerteGruppe(gruppe, mitWerten(gruppe, ['100']))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })

  it.each([
    ['eine Kommazahl', '50.5'],
    ['eine deutsche Kommazahl', '50,5'],
    ['eine negative Zahl', '-1'],
    ['mehr als 100', '101'],
    ['Text', 'abc'],
  ])('%s meldet sich in jeder Gruppe am eigenen Feld', (_name, wert) => {
    for (const gruppe of PROZENTGRUPPEN) {
      const { verstoesse } = bewerteGruppe(gruppe, mitWerten(gruppe, [wert]))
      expect(verstoesse, gruppe.id).toEqual([
        {
          pfad: gruppe.felder[0].pfad,
          schluessel: 'protokoll.regeln.prozentKeineGanzeZahl',
        },
      ])
    }
  })

  /* A group holding something that is not a number has no total worth
     complaining about, and two messages for one mistake is noise. */
  it('unterdrueckt die Summenmeldung, solange ein Anteil keine Zahl ist', () => {
    const { verstoesse } = bewerteGruppe(UMLAND, mitWerten(UMLAND, ['abc', '10']))
    expect(verstoesse).toHaveLength(1)
    expect(verstoesse[0].schluessel).toBe('protokoll.regeln.prozentKeineGanzeZahl')
  })

  it('zaehlt 0 als gegebene Antwort und nicht als leer', () => {
    const { summe, verstoesse } = bewerteGruppe(UMLAND, mitWerten(UMLAND, ['0']))
    expect(summe).toBe(0)
    expect(verstoesse).toEqual([
      { pfad: UMLAND.id, schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it('ignoriert Leerzeichen um einen Anteil', () => {
    const { summe, verstoesse } = bewerteGruppe(UMLAND, mitWerten(UMLAND, [' 100 ']))
    expect(summe).toBe(100)
    expect(verstoesse).toEqual([])
  })
})

describe('pruefeProzentgruppen', () => {
  it('sagt zu einem leeren Entwurf nichts', () => {
    expect(pruefeProzentgruppen({})).toEqual([])
  })

  /* Defect 1 in docs/ffs-defect-list.md, named on its own so it cannot be
     dropped by accident. The legacy form maintains check_ok_substrat as the user
     types and never reads it at submit, so a substrate distribution totalling 43
     is sent and accepted. */
  it('prueft die Substratverteilung wie jede andere Gruppe', () => {
    const verstoesse = pruefeProzentgruppen(verteilt(SUBSTRAT, 43))
    expect(verstoesse).toEqual([
      { pfad: 'summe.substrat', schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })

  it('meldet jede falsche Gruppe einzeln', () => {
    const antworten = {
      ...verteilt(UMLAND, 83),
      ...verteilt(SUBSTRAT, 120),
    }
    const pfade = pruefeProzentgruppen(antworten).map(({ pfad }) => pfad)
    expect(pfade).toEqual(['summe.umland', 'summe.substrat'])
  })

  it('laesst die anderen Gruppen in Ruhe, wenn eine falsch ist', () => {
    const verstoesse = pruefeProzentgruppen(verteilt(UMLAND, 83))
    expect(verstoesse).toHaveLength(1)
    expect(verstoesse[0].pfad).toBe('summe.umland')
  })

  /* The three ufer groups share one branch in the answers document, so a value in
     one is a sibling of a value in another. Nothing may leak across. */
  it('haelt die drei Ufer-Gruppen auseinander', () => {
    const verstoesse = pruefeProzentgruppen(verteilt(UFERNEIGUNG, 50))
    expect(verstoesse).toEqual([
      { pfad: 'summe.neigung', schluessel: 'protokoll.regeln.prozentsummeNichtHundert' },
    ])
  })
})
