import { describe, expect, it } from 'vitest'
import { gespeichert, sammle } from './beschriftungen.ts'

/* That the committed labels still match the components they were read from.
 *
 * The file is generated but committed, the same arrangement felder.json and
 * optionslisten.json already have: the backend reads it at run time and cannot
 * run the frontend's toolchain to produce it. A committed generated file is only
 * as good as the test that notices when it goes stale, and this is that test.
 *
 * It fails the moment somebody renames a label in de.json, adds a field, or
 * moves one between blocks, and the fix is always the same: npm run
 * beschriftungen, then commit what changed.
 *
 * What is deliberately NOT here is whether every field of the legacy form has a
 * label. That list is the 485 answer fields, and which of the form's 540 fields
 * those are is decided in app/protokolle/einlesen/felder.py, by name, for
 * reasons that file explains at length. Asking the same question here would mean
 * a second copy of those 55 names. The backend asks it instead, in
 * app/protokolle/ausgabe/beschriftungen_test.py.
 */
describe('die Beschriftungen aus den Formularbloecken', () => {
  it('stimmen mit der abgelegten Datei ueberein', () => {
    expect(sammle()).toEqual(gespeichert())
  })

  it('nennen fuer jeden Pfad einen nicht leeren deutschen Text', () => {
    for (const [pfad, wort] of Object.entries(sammle().beschriftungen)) {
      expect(wort, pfad).not.toBe('')
    }
  })

  /* Three shapes of declaration, one per rule the reader implements. If a rule
     stops working, the count drops and the comparison above fails, but it fails
     with 174 numbers on the screen; these three say which rule broke.

     hydrologie.breite is written out in the component, ufer.graeser is declared
     as data in teil3/gruppen.ts, and bewirschaftung.besatz_fischart3 is a row
     mapped over teil4/bloecke.ts, where the path and the label meet only through
     the destructured property name. */
  it.each([
    ['im Bauteil geschrieben', 'hydrologie.breite', 'mittlere Breite'],
    ['als Daten deklariert', 'ufer.graeser', 'Gräser'],
    ['ueber eine Zeilentabelle', 'bewirschaftung.besatz_fischart3', 'Fischart'],
  ])('lesen einen Pfad, der %s ist', (_wie, pfad, wort) => {
    expect(sammle().beschriftungen[pfad]).toBe(wort)
  })
})
