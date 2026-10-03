import { describe, expect, it } from 'vitest'
import optionslisten from '@formular/optionslisten.json'
import { platzhalter } from '../../api/fehler'
import de from './de.json'
import en from './en.json'
import optionenEn from './optionen.en.json'

/* The guard on the English file.
 *
 * The two files hold the same keys, and every English text names the same
 * {{placeholders}} as its German one: a different set renders a raw "{{anzahl}}"
 * or silently drops a number the German sentence gives. The server's refusals
 * under fehler.server are held to the backend's codes from the other side, by
 * backend/app/api/fehler_wortlaut_test.py.
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


/* The same reading of a placeholder the app makes when it decides whether a
   server refusal can use its key, so the guard and the app cannot disagree. */
const sortiert = (text: string) => platzhalter(text).sort().join()

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
      .filter(([k, text]) => sortiert(text) !== sortiert(deutsch.get(k)!))
      .map(([k]) => k)
    expect(abweichend).toEqual([])
  })

  /* Closed in feature 17e, the last sub-feature of 17: no German text renders
     German on an English screen through the fallback any more, so a new key
     without English is a key somebody forgot. */
  it('translates every key de.json has', () => {
    const fehlend = [...deutsch.keys()].filter((k) => !englisch.has(k))
    expect(fehlend).toEqual([])
  })

  it('reads the placeholders it compares', () => {
    expect(platzhalter('{{sprache}} gilt, klicken Sie {{ kuerzel }}').sort()).toEqual(['kuerzel', 'sprache'])
    expect(platzhalter('{{anzahl, number}} Zeilen')).toEqual(['anzahl'])
  })
})

/* The English dropdown entries, feature 17d. German is not in this file: it stays
   in the seed file, so the guard holds the English against that instead. */
describe('optionen.en.json', () => {
  const seed = optionslisten.listen as Record<string, { wert: string }[]>
  const englischeListen = optionenEn as Record<string, Record<string, string>>

  it('names only lists and codes the seed file has', () => {
    const fremd = Object.entries(englischeListen).flatMap(([liste, texte]) =>
      Object.keys(texte)
        .filter((wert) => !seed[liste]?.some((option) => option.wert === wert))
        .map((wert) => `${liste}: ${wert}`),
    )
    expect(fremd).toEqual([])
  })

  /* The short descriptions decided on 2026-09-30. Left out on purpose: species,
     device models and the monitoring stretches, which keep their German names
     and have only a few entries translated; the four Regierungspraesidien, the
     names of authorities; and the width and still-water ranges, whose German
     labels hold no word and no decimal comma, so English would be a copy. */
  it.each([
    'anlass',
    'gewaessertyp',
    'messdaten.regenfaelle',
    'messdaten.truebung',
    'messdaten.schaumbildung',
    'hydrologie.tiefe',
    'hydrologie.fliessgeschwindigkeit',
    'hydrologie.tiefenvarianz',
    'hydrologie.linienfuehrung',
    'hydrologie.stroemung',
    'hydrologie.wasserfuehrung',
    'hydrologie.gesamtprofil',
    'ufer.randstreifen',
    'ausruestung.bauweise',
    'ausruestung.kathode',
    'z.quelle',
  ])('translates every entry of %s', (liste) => {
    const fehlend = seed[liste]
      .map(({ wert }) => wert)
      .filter((wert) => englischeListen[liste]?.[wert] === undefined)
    expect(fehlend).toEqual([])
  })

  it('leaves no decimal comma in an English entry', () => {
    const mitKomma = Object.values(englischeListen)
      .flatMap((texte) => Object.values(texte))
      .filter((text) => /\d,\d/.test(text))
    expect(mitKomma).toEqual([])
  })
})
