import { describe, expect, it } from 'vitest'
import {
  entfernenSchreiben,
  anfangsZeilen,
  letzteGefuellteZeile,
  zeileEntfernen,
  zeileIstLeer,
  type Artengruppe,
} from './zeilen'
import { MAX_ARTEN } from './tabelle'

/* Which catch rows are open, and what removing one does to the rest.
 *
 * Worth testing on its own because both halves are invisible when wrong. A row
 * count that is one too low silently refuses a surveyor the row they are trying
 * to add; a shift that leaves a hole sends an empty art2 between two filled ones
 * to FiaKa years later. Neither shows up as an error on screen.
 */

const bachforelle = { name: 'BFOR', klasse_1: '12' }
const groppe = { name: 'GROP', klasse_2: '4' }
const aesche = { name: 'AESC', klasse_3: '7' }

describe('zeileIstLeer', () => {
  it('haelt eine fehlende Zeile fuer leer', () => {
    expect(zeileIstLeer(undefined)).toBe(true)
  })

  it('haelt eine Zeile aus leeren Zeichenketten fuer leer', () => {
    expect(zeileIstLeer({ name: '', klasse_1: '', '0plus': '  ' })).toBe(true)
  })

  /* A count with no species is still an answer somebody typed, so the row is
     not empty and must not be closed under them. */
  it('haelt eine Zeile mit einer Zahl, aber ohne Art, fuer gefuellt', () => {
    expect(zeileIstLeer({ klasse_4: '3' })).toBe(false)
  })

  it('haelt eine Zeile mit nur einer Art fuer gefuellt', () => {
    expect(zeileIstLeer({ name: 'BFOR' })).toBe(false)
  })

  it('sieht auch die letzte Spalte', () => {
    expect(zeileIstLeer({ '0plus': '2' })).toBe(false)
  })
})

describe('anfangsZeilen', () => {
  it('oeffnet eine leere Zeile fuer ein frisches Protokoll', () => {
    expect(anfangsZeilen(undefined)).toBe(1)
    expect(anfangsZeilen({})).toBe(1)
  })

  /* A draft saved before feature 9a has no arten key at all. It must open like
     a fresh one rather than throwing. */
  it('kommt mit einem Entwurf ohne Artengruppe zurecht', () => {
    expect(anfangsZeilen(undefined)).toBe(1)
  })

  it('oeffnet eine Zeile mehr, als gefuellt sind', () => {
    expect(anfangsZeilen({ art1: bachforelle })).toBe(2)
    expect(anfangsZeilen({ art1: bachforelle, art2: groppe })).toBe(3)
  })

  /* A hole should not happen, since removing a row closes it, but a
     hand-edited draft can carry one. Opening up to the last filled row is the
     only answer that does not hide an answer somebody gave. */
  it('oeffnet bis zur letzten gefuellten Zeile, auch bei einer Luecke', () => {
    expect(anfangsZeilen({ art1: bachforelle, art5: groppe })).toBe(6)
  })

  it('bietet keine 27. Zeile an, wenn die Tabelle voll ist', () => {
    const voll: Artengruppe = {}
    for (let n = 1; n <= MAX_ARTEN; n++) {
      voll[`art${n}` as keyof Artengruppe] = bachforelle
    }
    expect(letzteGefuellteZeile(voll)).toBe(26)
    expect(anfangsZeilen(voll)).toBe(26)
  })
})

describe('zeileEntfernen', () => {
  it('rueckt die Zeilen darunter nach oben', () => {
    const neu = zeileEntfernen(
      { art1: bachforelle, art2: groppe, art3: aesche },
      2,
    )
    expect(neu.art1).toEqual(bachforelle)
    expect(neu.art2).toEqual(aesche)
    expect(zeileIstLeer(neu.art3)).toBe(true)
  })

  it('entfernt die letzte Zeile, ohne die davor anzufassen', () => {
    const neu = zeileEntfernen({ art1: bachforelle, art2: groppe }, 2)
    expect(neu.art1).toEqual(bachforelle)
    expect(zeileIstLeer(neu.art2)).toBe(true)
  })

  it('entfernt die erste Zeile und zieht alles hoch', () => {
    const neu = zeileEntfernen(
      { art1: bachforelle, art2: groppe, art3: aesche },
      1,
    )
    expect(neu.art1).toEqual(groppe)
    expect(neu.art2).toEqual(aesche)
    expect(zeileIstLeer(neu.art3)).toBe(true)
  })

  it('leert die einzige Zeile, statt sie verschwinden zu lassen', () => {
    const neu = zeileEntfernen({ art1: bachforelle }, 1)
    expect(zeileIstLeer(neu.art1)).toBe(true)
  })

  /* The cleared tail is written as empty strings rather than left undefined.
     React Hook Form only updates an input it is given a value for, so an absent
     last row would keep showing the values that moved up out of it. */
  it('schreibt die frei gewordene Zeile ausdruecklich leer', () => {
    const neu = zeileEntfernen({ art1: bachforelle, art2: groppe }, 1)
    expect(neu.art2).toEqual({
      name: '',
      klasse_1: '',
      klasse_2: '',
      klasse_3: '',
      klasse_4: '',
      klasse_5: '',
      klasse_6: '',
      klasse_7: '',
      klasse_8: '',
      klasse_9: '',
      klasse_10: '',
      '0plus': '',
    })
  })

  it('gibt immer alle 26 Zeilen zurueck, damit keine Zelle stehen bleibt', () => {
    const neu = zeileEntfernen({ art1: bachforelle }, 1)
    expect(Object.keys(neu)).toHaveLength(MAX_ARTEN)
  })

  it('kommt mit einer vollen Tabelle zurecht', () => {
    const voll: Artengruppe = {}
    for (let n = 1; n <= MAX_ARTEN; n++) {
      voll[`art${n}` as keyof Artengruppe] = { name: 'BFOR', klasse_1: String(n) }
    }
    const neu = zeileEntfernen(voll, 1)
    expect(neu.art1?.klasse_1).toBe('2')
    expect(neu.art25?.klasse_1).toBe('26')
    expect(zeileIstLeer(neu.art26)).toBe(true)
  })

  it('laesst die Tabelle unveraendert ausser der einen Zeile', () => {
    const vorher: Artengruppe = { art1: bachforelle, art2: groppe, art3: aesche }
    const neu = zeileEntfernen(vorher, 3)
    expect(neu.art1).toEqual(bachforelle)
    expect(neu.art2).toEqual(groppe)
    // The original is not touched: the caller applies the result separately.
    expect(vorher.art3).toEqual(aesche)
  })
})

describe('entfernenSchreiben', () => {
  /* The shift has to reach the form as one write per field. A single setValue
     over the whole group updates the registered number inputs and leaves the
     Controller-driven species pickers showing the value that moved up out of
     them, which is a bug this test exists to keep fixed. */
  it('schreibt jedes Feld einzeln, statt die Gruppe auf einmal', () => {
    const schreiben = entfernenSchreiben(
      { art1: bachforelle, art2: groppe, art3: aesche },
      2,
    )
    const nach = new Map(schreiben.map(({ pfad, wert }) => [pfad, wert]))

    expect(nach.get('arten.art2.name')).toBe('AESC')
    expect(nach.get('arten.art2.klasse_3')).toBe('7')
    expect(nach.get('arten.art3.name')).toBe('')
    expect(nach.get('arten.art3.klasse_3')).toBe('')
  })

  /* Every field of every touched row, including the ones that end up blank.
     A field left out keeps whatever the input already had on screen. */
  it('schreibt alle zwoelf Felder jeder betroffenen Zeile', () => {
    const schreiben = entfernenSchreiben({ art1: bachforelle }, 1)
    expect(schreiben).toHaveLength(MAX_ARTEN * 12)
  })

  /* Rows above the removed one did not move, so writing them would be 312
     pointless notifications on every click. */
  it('laesst die Zeilen oberhalb der entfernten unangetastet', () => {
    const schreiben = entfernenSchreiben(
      { art1: bachforelle, art2: groppe, art3: aesche },
      3,
    )
    expect(schreiben).toHaveLength((MAX_ARTEN - 2) * 12)
    expect(schreiben.every(({ pfad }) => !pfad.startsWith('arten.art1.'))).toBe(true)
    expect(schreiben.every(({ pfad }) => !pfad.startsWith('arten.art2.'))).toBe(true)
  })
})
