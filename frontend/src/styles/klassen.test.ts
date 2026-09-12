import { describe, expect, it } from 'vitest'

/* The app has one name for visually hidden text, and it is visually-hidden.
 *
 * Added on 2026-09-12 after sr-only reached the screen. It is the utility name a
 * great many projects use, and the one the throwaway mockups under prototypes/
 * use, but this app has never had it: components/shell.css defines
 * visually-hidden and says why it lives there rather than in a screen's own
 * stylesheet.
 *
 * Nothing caught it. The build passed, the types passed, all 1136 tests passed,
 * and the step bar printed its screen-reader text at full size across the whole
 * navigation, squeezing every section label into a column one word wide. Mansi
 * found it by looking at the screen.
 *
 * That is the shape of failure worth guarding here. A class name is a string, so
 * an imagined one is neither a type error nor a test failure: it is styling that
 * silently does not happen, and on a project with no browser automation there is
 * nothing else to catch it.
 *
 * A wider check, that every class written anywhere exists in some stylesheet,
 * would be better and is not possible from here: Vite hands a stylesheet's text
 * back empty under ?raw and ?inline in a node test environment, and reading the
 * files directly would mean putting Node's types into the browser's tsconfig.
 * Worth doing if the question comes up again.
 */

const BAUSTEINE = Object.entries(
  import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
).filter(([pfad]) => !pfad.includes('.test.')) as [string, string][]

/** Names that mean "hidden from sight, not from a screen reader" elsewhere. */
const FREMDE_SCHREIBWEISEN = [
  'sr-only',
  'screen-reader-only',
  'screenreader-only',
  'visuallyhidden',
  'visually-hidden-text',
  'hidden-visually',
  'a11y-hidden',
]

const genutzt = BAUSTEINE.flatMap(([pfad, text]) =>
  [...text.matchAll(/className="([^"{}]*)"/g)].flatMap((treffer) =>
    treffer[1]
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => ({ name, pfad })),
  ),
)

describe('Klassennamen fuer versteckten Text', () => {
  it('findet ueberhaupt Klassen, sonst prueft dieser Test nichts', () => {
    expect(genutzt.length).toBeGreaterThan(20)
  })

  it.each(FREMDE_SCHREIBWEISEN)('verwendet %s nirgends', (fremd) => {
    const treffer = genutzt.filter(({ name }) => name === fremd)

    expect(treffer).toEqual([])
  })

  /* And the name the app does use is really in use, so this test cannot pass by
     the app having quietly stopped hiding anything at all. */
  it('benutzt visually-hidden', () => {
    expect(genutzt.filter(({ name }) => name === 'visually-hidden').length).toBeGreaterThan(0)
  })
})
