import felder from '@formular/felder.json'
import { describe, expect, it } from 'vitest'
import {
  ANODEN_FELDER,
  BEFISCHTE_BEREICHE,
  BREITE_FELDER,
  LAENGE_FELDER,
  NETZE,
  ZAHLENFELDER,
} from './bloecke'
import type { AntwortPfad } from '../../entwurf/typen'

/* Twenty-six field paths are transcribed by hand into section 5, and every one
   has to match the legacy PDF exactly. coding-standards.md makes that match the
   thing that keeps the eventual FiaKa transfer a direct mapping rather than a
   lookup table somebody maintains.

   A misspelling is invisible in the running app: the field renders, accepts an
   answer and saves it. It would surface years later as a column FiaKa cannot
   fill. felder.json is the extracted record of the real form, so it is what the
   paths are checked against.

   TypeScript already covers the other direction. Every path is typed
   AntwortPfad, so one that is not in the answers document is a build error.

   Section 5 is where the two directions matter for a different reason than
   section 4's. Part 4 had two oddly spelled paths that look like mistakes; part
   5 has fourteen near-identical ones. ges_gew_vom_ufer and ufer_vom_ufer are one
   character apart in meaning and several in spelling, and a row wired to the
   other row's field would look completely normal on screen. */

const NAMEN = new Set(felder.felder.map((feld) => feld.name))

/* The ten equipment fields and the two Anodenführer names are written out in
   AusruestungBlock.tsx rather than declared, because they differ from one
   another in type, unit and control and a shared definition would buy nothing.
   They are listed here so the transcription check covers all twenty-six paths
   rather than only the sixteen that are declared, which is what makes the
   completeness check at the bottom possible. */
const LOSE_PFADE: readonly AntwortPfad[] = [
  'ausruestung.egeraet',
  'ausruestung.spannung',
  'ausruestung.leistung',
  'ausruestung.bauweise',
  'ausruestung.ringanoden',
  'ausruestung.ringanoden_durchmesser',
  'ausruestung.kathode',
  'ausruestung.streifenanoden',
  'anodenfuehrer.vorname',
  'anodenfuehrer.nachname',
]

const BEREICHSPFADE = BEFISCHTE_BEREICHE.flatMap(
  ({ laenge, breite, richtung, methode }): AntwortPfad[] => [
    laenge,
    breite,
    ...richtung.map(({ pfad }) => pfad),
    ...methode.map(({ pfad }) => pfad),
  ],
)

const ALLE_PFADE: readonly AntwortPfad[] = [
  ...LOSE_PFADE,
  ...NETZE.map(({ pfad }) => pfad),
  ...BEREICHSPFADE,
]

describe('die Felder von Teil 5', () => {
  it.each(ALLE_PFADE)('%s gibt es im Formular', (pfad) => {
    expect(NAMEN).toContain(pfad)
  })

  /* The counts are the printed form's, read off page 3. A run that quietly
     loses an entry to a bad merge still renders; the question simply stops
     being asked. */
  it('haelt die Anzahl der Felder je Lauf', () => {
    expect(NETZE).toHaveLength(2)
    expect(BEFISCHTE_BEREICHE).toHaveLength(2)
    for (const { richtung, methode } of BEFISCHTE_BEREICHE) {
      expect(richtung).toHaveLength(2)
      expect(methode).toHaveLength(3)
    }
    expect(ALLE_PFADE).toHaveLength(26)
  })

  it('nennt jedes Feld genau einmal', () => {
    expect(new Set(ALLE_PFADE).size).toBe(ALLE_PFADE.length)
  })

  /* Every label key is its own, so no two controls on the page read the same to
     a screen reader. The fished areas are the reason: "watend" appears twice,
     and in the printed form only the row it sits in tells them apart. */
  it('gibt jedem Kaestchen der beiden Bereiche einen eigenen Text', () => {
    const schluessel = BEFISCHTE_BEREICHE.flatMap(({ richtung, methode }) =>
      [...richtung, ...methode].map(({ labelKey }) => labelKey),
    )

    expect(new Set(schluessel).size).toBe(schluessel.length)
  })

  /* The pairs the rules check run across the two rows, not down them. Wired the
     other way each rule would silently become a row completeness check, which
     is not what the legacy form does. */
  it('paart die beiden Laengen und die beiden Breiten ueber die Zeilen hinweg', () => {
    expect(LAENGE_FELDER).toEqual([
      'befischte_bereiche.ges_gew_laenge',
      'befischte_bereiche.ufer_laenge',
    ])
    expect(BREITE_FELDER).toEqual([
      'befischte_bereiche.ges_gew_breite',
      'befischte_bereiche.ufer_breite',
    ])
    expect(ANODEN_FELDER).toEqual([
      'ausruestung.ringanoden',
      'ausruestung.streifenanoden',
    ])
  })

  /* The nine quantities are a selection across the section rather than a run of
     their own, so they are not in ALLE_PFADE and would otherwise go unchecked
     against felder.json. A path misspelled here fails no other test: the field
     still renders, and only the sign rule silently stops covering it. */
  it('nennt als Zahlenfelder nur Felder, die der Abschnitt auch rendert', () => {
    expect(ZAHLENFELDER).toHaveLength(9)
    for (const pfad of ZAHLENFELDER) {
      expect(NAMEN).toContain(pfad)
      expect(ALLE_PFADE).toContain(pfad)
    }
  })

  /* The strongest of these, and the reason the loose paths are listed above.
     Every other check asks whether what we render is real. This one asks the
     opposite: whether anything real went unrendered.

     ausruestung, anodenfuehrer and befischte_bereiche belong to section 5
     entirely, so the set of paths the section renders must equal the set the
     form has. A field forgotten during transcription fails here and nowhere
     else, because a missing field looks like nothing at all. */
  it.each(['ausruestung', 'anodenfuehrer', 'befischte_bereiche'])(
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
})
