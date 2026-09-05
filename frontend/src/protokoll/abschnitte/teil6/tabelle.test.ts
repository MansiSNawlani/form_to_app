import felder from '@formular/felder.json'
import { get, set } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import {
  ARTNUMMERN,
  ABGELEITETE_FELDER,
  GESAMTSUMME_FELD,
  KLASSEN,
  MAX_ARTEN,
  alleArtPfade,
  artPfad,
  klassenPfade,
} from './tabelle'

/* Section 6 is 339 of the form's 540 fields, and not one of them is written out
   by hand: they are generated from KLASSEN and ARTNUMMERN. That is what makes
   the section buildable at all, and it is also what makes this test necessary.
   A misspelled suffix here does not break one field, it breaks a column of
   twenty-six, and it breaks them invisibly: the cells still render, still accept
   an answer and still save it. It would surface years later as a column FiaKa
   cannot fill.

   felder.json is the extracted record of the real form, so it is what the
   generated paths are checked against. TypeScript covers the other direction:
   every path is typed AntwortPfad, so one that is not in the answers document is
   a build error.

   The counts are worth stating plainly, because two of them look wrong until the
   third explains them:

     339  arten fields in the legacy form
     312  answered by a surveyor, 26 rows x 12, and the ones generated here
      27  worked out by the form itself, 26 row sums plus the grand total

   The 27 are deliberately absent from the answers document. They are calculated,
   read-only fields in the PDF, so storing them would let a hand-edited draft
   carry a total that disagrees with its own cells. This test asserts the absence
   on purpose, so it reads as a decision rather than as 27 fields somebody forgot.
*/

const NAMEN = new Set(felder.felder.map((feld) => feld.name))
const ARTEN_IM_FORMULAR = felder.felder
  .map((feld) => feld.name)
  .filter((name) => name === 'arten' || name.startsWith('arten.'))

describe('die Felder von Teil 6', () => {
  it('kennt 26 Zeilen und 10 Groessenklassen', () => {
    expect(MAX_ARTEN).toBe(26)
    expect(ARTNUMMERN).toHaveLength(26)
    expect(ARTNUMMERN[0]).toBe(1)
    expect(ARTNUMMERN.at(-1)).toBe(26)
    expect(KLASSEN).toHaveLength(10)
  })

  it('erzeugt 312 Pfade, also 26 Zeilen zu je 12 Feldern', () => {
    expect(alleArtPfade()).toHaveLength(312)
    expect(klassenPfade(1)).toHaveLength(10)
  })

  it.each(alleArtPfade())('%s gibt es im Formular', (pfad) => {
    expect(NAMEN).toContain(pfad)
  })

  it('nennt jeden Pfad genau einmal', () => {
    const pfade = alleArtPfade()
    expect(new Set(pfade).size).toBe(pfade.length)
  })

  /* The strongest check here, and the reason ABGELEITETE_FELDER is exported at
     all. Every other assertion asks whether what we generate is real. This one
     asks the opposite: whether anything real went ungenerated. The arten group
     belongs to section 6 entirely, so the paths we store plus the totals we
     deliberately do not must together be exactly the group, with nothing left
     over on either side. A field forgotten during transcription fails here and
     nowhere else, because a missing field looks like nothing at all. */
  it('teilt die 339 Artenfelder rueckstandslos in gespeicherte und abgeleitete auf', () => {
    expect(ARTEN_IM_FORMULAR).toHaveLength(339)
    expect(ABGELEITETE_FELDER).toHaveLength(27)

    const abgedeckt = [...alleArtPfade(), ...ABGELEITETE_FELDER]
    expect(abgedeckt.sort()).toEqual([...ARTEN_IM_FORMULAR].sort())
  })

  /* The 27 are in the form and deliberately not in the draft. Stated as its own
     assertion so that adding one to Antworten later fails loudly rather than
     quietly making the draft the second, disagreeing source of a total. */
  it('speichert keine Summe, weil das Formular sie selbst rechnet', () => {
    expect(NAMEN).toContain(GESAMTSUMME_FELD)
    expect(NAMEN).toContain('arten.art1.summe')

    for (const pfad of alleArtPfade()) {
      expect(pfad.endsWith('.summe')).toBe(false)
    }
    expect(alleArtPfade()).not.toContain(GESAMTSUMME_FELD)
  })

  /* The ten headings are what tells one numeric cell from the next, on screen
     and to a screen reader. Two columns sharing a key would make two different
     size classes indistinguishable, which is worse than a missing label. */
  it('gibt jeder Groessenklasse eigene Texte', () => {
    const kopf = KLASSEN.map(({ kopfKey }) => kopfKey)
    const namen = KLASSEN.map(({ nameKey }) => nameKey)

    expect(new Set(kopf).size).toBe(10)
    expect(new Set(namen).size).toBe(10)
  })

  /* The order is the printed form's, taken from the widget rectangles on page 3:
     klasse_1 sits at x=210 and klasse_10 at x=473, ascending left to right. A
     reordering here would silently file every catch under the wrong size. */
  it('haelt die Groessenklassen in der gedruckten Reihenfolge', () => {
    expect(KLASSEN.map(({ feld }) => feld)).toEqual([
      'klasse_1',
      'klasse_2',
      'klasse_3',
      'klasse_4',
      'klasse_5',
      'klasse_6',
      'klasse_7',
      'klasse_8',
      'klasse_9',
      'klasse_10',
    ])
  })

  it('setzt Pfade aus Zeile und Feld zusammen', () => {
    expect(artPfad(7, 'name')).toBe('arten.art7.name')
    expect(artPfad(7, 'klasse_3')).toBe('arten.art7.klasse_3')
    expect(artPfad(26, '0plus')).toBe('arten.art26.0plus')
  })

  /* 0plus is the only field path on the whole form that begins with a digit, and
     React Hook Form decides between an object key and an array index by looking
     at exactly that. If it read "0plus" as an index, every young-of-year answer
     would land in a sparse array and the saved draft would come back a different
     shape than it went in.

     It does not, because "0plus" is not a number. Asserted rather than reasoned
     about, using React Hook Form's own get and set, which is what register and
     the draft store go through. A change of that parsing in a later version is
     otherwise invisible until a surveyor loses 26 answers. */
  it('behandelt 0plus als Objektschluessel, nicht als Array-Index', () => {
    const werte: Record<string, unknown> = {}
    set(werte, artPfad(1, '0plus'), '8')
    set(werte, artPfad(1, 'klasse_1'), '12')

    expect(werte).toEqual({ arten: { art1: { '0plus': '8', klasse_1: '12' } } })
    expect(Array.isArray((werte.arten as Record<string, unknown>).art1)).toBe(false)
    expect(get(werte, artPfad(1, '0plus'))).toBe('8')
  })
})
