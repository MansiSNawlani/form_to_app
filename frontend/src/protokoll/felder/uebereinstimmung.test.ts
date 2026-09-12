/* The screen and the gate have to mark the same fields.
 *
 * This is the test the whole of steps 9 to 14 exists for. Until 2026-09-12
 * requiredness lived twice, as a list on the server and as props scattered
 * through the form's components, and the two had drifted: 31 fields were enforced
 * out of roughly 156, parts 3 and 4 enforced nothing at all, and a field marked
 * required on screen that nothing checked looked exactly like one that works.
 *
 * There is now one file, so agreement is structural rather than checked. What is
 * still worth holding is what a person can undo by hand: a component going back
 * to carrying its own answer, or a field being required that no screen renders.
 * Both would be invisible in review and obvious to a surveyor.
 */

import { describe, expect, it } from 'vitest'
import { pflichtfelderListe } from './pflicht'

/* Read through Vite's own raw import rather than through the filesystem, so this
   stays browser-side code with no Node types in a browser tsconfig. eager, so the
   sources are strings by the time the cases below run. */
function ohneTests(module: Record<string, string>): string[] {
  return Object.entries(module)
    .filter(([pfad]) => !pfad.includes('.test.'))
    .map(([, text]) => text)
}

/** The components only, for the question of who decides requiredness. */
const BAUSTEINE = ohneTests(
  import.meta.glob('../abschnitte/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)

/** Components and the declaration files the repeating blocks are rendered from. */
const ALLES = [
  ...BAUSTEINE,
  ...ohneTests(
    import.meta.glob('../abschnitte/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ),
]

/* Every answer path the form mentions, however it is rendered: written out as a
   name prop in parts 1 and 2, or declared as a pfad in the lists that parts 3, 4
   and 5 map over. */
const GERENDERT = new Set(
  ALLES.flatMap((text) => [
    ...[...text.matchAll(/name="([a-z_0-9.]+)"/g)].map((treffer) => treffer[1]),
    ...[...text.matchAll(/pfad: '([a-z_0-9.]+)'/g)].map((treffer) => treffer[1]),
  ]),
)

describe('Bildschirm und Absende-Pruefung', () => {
  /* A bare `pflicht` prop is a component deciding for itself. That is exactly
     what the shared file replaced, and one creeping back would mark a field on
     screen that the server may know nothing about. */
  it('kein Abschnittsbaustein behauptet Pflicht auf eigene Faust', () => {
    const eigenmaechtig = BAUSTEINE.filter((text) => /\n\s*pflicht\s*\n/.test(text))

    expect(eigenmaechtig).toHaveLength(0)
  })

  /* The conditional ones are the deliberate exception, and there are few enough
     to name. Each computes its own answer because it depends on another field:
     today that is the Monitoringstrecken-Nr. under a WRRL or FFH occasion, which
     monitoring.py enforces on the other side. */
  it('nur die bedingten Felder rechnen ihre Pflicht selbst aus', () => {
    const bedingt = BAUSTEINE.flatMap((text) => [
      ...[...text.matchAll(/pflicht=\{([^}]+)\}/g)].map((treffer) => treffer[1]),
    ])

    expect(bedingt).toEqual(['istMonitoringAnlass(anlass)'])
  })

  /* A required field that no screen renders would refuse a protocol with no way
     to repair it: the panel would name a field and link to a section that does
     not contain it. */
  it.each(pflichtfelderListe())('zeigt %s auch wirklich an', (pfad) => {
    expect(GERENDERT.has(pfad)).toBe(true)
  })
})
