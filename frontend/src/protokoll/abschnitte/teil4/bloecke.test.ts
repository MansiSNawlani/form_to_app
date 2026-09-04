import felder from '@formular/felder.json'
import { describe, expect, it } from 'vitest'
import { BESATZZEILEN, BEWIRTSCHAFTUNG, EINFLUESSE, STRUKTUREN } from './bloecke'
import type { AntwortPfad } from '../../entwurf/typen'

/* Forty-three field paths are transcribed by hand into section 4, and every one
   has to match the legacy PDF exactly. coding-standards.md makes that match the
   thing that keeps the eventual FiaKa transfer a direct mapping rather than a
   lookup table somebody maintains.

   A misspelling is invisible in the running app: the field renders, accepts an
   answer and saves it. It would surface years later as a column FiaKa cannot
   fill. felder.json is the extracted record of the real form, so it is what the
   paths are checked against.

   TypeScript already covers the other direction. Every path is typed
   AntwortPfad, so one that is not in the answers document is a build error.

   Section 4 is the section where this matters most. Its three field groups
   carry the two oddities the whole form has: bewirschaftung is missing a t, and
   sonstige_Nutzung has a capital N. Both are legacy paths and both look exactly
   like mistakes, so something has to hold them in place. */

const NAMEN = new Set(felder.felder.map((feld) => feld.name))

/* The four answers that are written out in their components rather than
   declared as data, because each differs from the others and a shared
   definition would buy nothing. They are listed here so the transcription check
   covers all forty-three paths rather than thirty-nine, which is what makes the
   completeness check below possible. */
const LOSE_PFADE: readonly AntwortPfad[] = [
  'strukturen.sonstige_strukturen_text',
  'einfluesse.sonstige_nutzung_text',
  'bewirschaftung.fischereiausübungsberechtigter',
  'bemerkungen.sonstige_bemerkungen',
]

const ZEILENPFADE = BESATZZEILEN.flatMap(({ fischart, groessenklassen, jahr }) => [
  fischart,
  groessenklassen,
  jahr,
])

const ALLE_PFADE: readonly AntwortPfad[] = [
  ...STRUKTUREN.map(({ pfad }) => pfad),
  ...EINFLUESSE.map(({ pfad }) => pfad),
  ...BEWIRTSCHAFTUNG.map(({ pfad }) => pfad),
  ...ZEILENPFADE,
  ...LOSE_PFADE,
]

describe('die Felder von Teil 4', () => {
  it.each(ALLE_PFADE)('%s gibt es im Formular', (pfad) => {
    expect(NAMEN).toContain(pfad)
  })

  /* The counts are the printed form's, read off page 2. A run that quietly
     loses an entry to a bad merge still renders; the question simply stops
     being asked. */
  it('haelt die Anzahl der Felder je Lauf', () => {
    expect(STRUKTUREN).toHaveLength(8)
    expect(EINFLUESSE).toHaveLength(15)
    expect(BEWIRTSCHAFTUNG).toHaveLength(4)
    expect(BESATZZEILEN).toHaveLength(4)
  })

  it('nennt jedes Feld genau einmal', () => {
    expect(new Set(ALLE_PFADE).size).toBe(ALLE_PFADE.length)
  })

  /* The strongest of these, and the reason the loose paths are listed above.
     Every other check asks whether what we render is real. This one asks the
     opposite: whether anything real went unrendered.

     strukturen, einfluesse and bewirschaftung belong to section 4 entirely, so
     the set of paths the section renders must equal the set the form has. A
     field forgotten during transcription fails here and nowhere else, because a
     missing field looks like nothing at all. */
  it.each(['strukturen', 'einfluesse', 'bewirschaftung'])(
    'rendert jedes Feld der Gruppe %s',
    (gruppe) => {
      const imFormular = felder.felder
        .map((feld) => feld.name)
        .filter((name) => name.startsWith(`${gruppe}.`))
      expect([...ALLE_PFADE].filter((pfad) => pfad.startsWith(`${gruppe}.`)).sort()).toEqual(
        imFormular.sort(),
      )
    },
  )

  /* bemerkungen is the one group section 4 shares. sonstige_bemerkungen is
     printed at the foot of page 2 and belongs here; bemerkung_fische is printed
     above the catch table on page 3 and is feature 9's. default is a button in
     the margin, not an answer, so it gets no key at all. */
  it('nimmt von den Bemerkungen nur die Box am Fuss von Seite 2', () => {
    const bemerkungen = ALLE_PFADE.filter((pfad) => pfad.startsWith('bemerkungen.'))
    expect(bemerkungen).toEqual(['bemerkungen.sonstige_bemerkungen'])
  })

  /* The digit moves between the species field and its two neighbours, which is
     the legacy form's own inconsistency. Written down in three comments already;
     this is the one place that fails if somebody regularises it. */
  it('behaelt die Nummerierung der Besatzzeilen', () => {
    expect(BESATZZEILEN.map(({ nr }) => nr)).toEqual([1, 2, 3, 4])
    for (const { nr, fischart, groessenklassen, jahr } of BESATZZEILEN) {
      expect(fischart).toBe(`bewirschaftung.besatz_fischart${nr}`)
      expect(groessenklassen).toBe(`bewirschaftung.besatz${nr}_groessenklassen`)
      expect(jahr).toBe(`bewirschaftung.besatz${nr}_jahr`)
    }
  })
})
