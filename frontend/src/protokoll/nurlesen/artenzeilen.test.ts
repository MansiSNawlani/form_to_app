import { describe, expect, it } from 'vitest'
import { fangzeilen } from './artenzeilen'
import type { Artengruppe } from '../abschnitte/teil6/zeilen'

describe('fangzeilen', () => {
  it('zeigt nur die Zeilen, in denen etwas steht', () => {
    const arten = {
      art1: { name: 'BFOR', klasse_2: '34', '0plus': '41' },
      art2: { name: 'GROP', klasse_1: '8' },
    } as Artengruppe

    expect(fangzeilen(arten).map((zeile) => zeile.nr)).toEqual([1, 2])
  })

  it('lässt die übrigen vierundzwanzig Schubladen weg', () => {
    // The printed form opens 26 slots and a survey uses a handful. Twenty-two
    // rows of dashes would bury the four real ones, and the PDF's repeated-slot
    // count is not a target for this application.
    const arten = { art1: { name: 'BFOR' } } as Artengruppe

    expect(fangzeilen(arten)).toHaveLength(1)
  })

  it('zeigt eine Zeile mit Zahlen, aber ohne Art', () => {
    /* The case worth having a test for. A row holding counts and no species is
       not an empty slot, it is a filled-in row with a question hanging over it,
       and that question is often exactly why a reviewer sends a protocol back.
       Hiding it would take recorded animals off their screen. */
    const arten = { art1: { klasse_3: '12' } } as Artengruppe
    const zeilen = fangzeilen(arten)

    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].code).toBeUndefined()
    expect(zeilen[0].klassen[2]).toBe('12')
  })

  it('zeigt gar nichts, wenn die Tabelle leer ist', () => {
    expect(fangzeilen(undefined)).toEqual([])
    expect(fangzeilen({} as Artengruppe)).toEqual([])
  })

  it('behandelt einen Nichtnachweis wie jede andere Art', () => {
    /* OFAN is an ordinary entry in the species picker whose label happens to be
       "kein Nachweis". What it means was settled by feature 9b's rules before
       this protocol was ever submitted, so nothing here needs to know. */
    const arten = { art1: { name: 'OFAN' } } as Artengruppe
    const zeilen = fangzeilen(arten)

    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].code).toBe('OFAN')
  })

  it('hält Zeilennummern und Reihenfolge der gespeicherten Tabelle', () => {
    // The numbers are the printed form's and the eventual FiaKa transfer's, so a
    // gap in the middle must stay a gap rather than being closed up on screen.
    const arten = {
      art2: { name: 'GROP' },
      art5: { name: 'SCHM' },
    } as Artengruppe

    expect(fangzeilen(arten).map((zeile) => zeile.nr)).toEqual([2, 5])
  })

  it('gibt die zehn Klassen aufsteigend, mit Lücken als undefined', () => {
    const arten = { art1: { name: 'BFOR', klasse_1: '12', klasse_10: '2' } } as Artengruppe
    const { klassen } = fangzeilen(arten)[0]

    expect(klassen).toHaveLength(10)
    expect(klassen[0]).toBe('12')
    expect(klassen[1]).toBeUndefined()
    expect(klassen[9]).toBe('2')
  })
})
