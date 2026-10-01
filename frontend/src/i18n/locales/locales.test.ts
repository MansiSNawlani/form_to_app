import { describe, expect, it } from 'vitest'
import de from './de.json'
import en from './en.json'

/* The guard on the English file while features 17b to 17e fill it in.
 *
 * It allows a German key with no English yet, which falls back to German on
 * screen. It refuses the two mistakes the fallback cannot catch: an English key
 * German does not have, which nothing will ever read, and an English text naming
 * different {{placeholders}} from its German one, which renders a raw
 * "{{anzahl}}" or silently drops a number the German sentence gives. The last
 * sub-feature adds the missing half: every German key has an English one.
 */

type Baum = { [schluessel: string]: string | Baum }

function blaetter(baum: Baum, pfad = ''): Map<string, string> {
  const ergebnis = new Map<string, string>()
  for (const [schluessel, wert] of Object.entries(baum)) {
    const voll = pfad ? `${pfad}.${schluessel}` : schluessel
    if (typeof wert === 'string') ergebnis.set(voll, wert)
    else for (const [k, v] of blaetter(wert, voll)) ergebnis.set(k, v)
  }
  return ergebnis
}

function platzhalter(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1]).sort()
}

const deutsch = blaetter(de as Baum)
const englisch = blaetter(en as Baum)

describe('en.json', () => {
  it('holds no key that de.json lacks', () => {
    const fremd = [...englisch.keys()].filter((k) => !deutsch.has(k))
    expect(fremd).toEqual([])
  })

  it('uses the same placeholders as the German text for every key', () => {
    const abweichend = [...englisch]
      .filter(([k]) => deutsch.has(k))
      .filter(([k, text]) => platzhalter(text).join() !== platzhalter(deutsch.get(k)!).join())
      .map(([k]) => k)
    expect(abweichend).toEqual([])
  })

  // The screens 17b translated. 17e widens this to every namespace.
  it.each([
    'shell',
    'common',
    'anmeldung',
    'sitzung',
    'fehler',
    'protokolle',
    'pruefliste',
    'benutzerverwaltung',
  ])('translates every key under %s', (namensraum) => {
    const fehlend = [...deutsch.keys()]
      .filter((k) => k.startsWith(`${namensraum}.`))
      .filter((k) => !englisch.has(k))
    expect(fehlend).toEqual([])
  })

  it('reads the placeholders it compares', () => {
    expect(platzhalter('{{sprache}} gilt, klicken Sie {{ kuerzel }}')).toEqual(['kuerzel', 'sprache'])
    expect(platzhalter('{{anzahl, number}} Zeilen')).toEqual(['anzahl'])
  })
})
