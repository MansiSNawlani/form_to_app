import { describe, expect, it } from 'vitest'
import optionslisten from '@formular/optionslisten.json'
import de from './de.json'
import en from './en.json'
import optionenEn from './optionen.en.json'

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

  // The screens 17b translated, the form 17c translated and what surrounds the
  // form, 17d. 17e widens this to every namespace.
  it.each([
    'shell',
    'common',
    'anmeldung',
    'sitzung',
    'fehler',
    'protokolle',
    'pruefliste',
    'benutzerverwaltung',
    'protokoll.kopf',
    'protokoll.laedt',
    'protokoll.nichtGefunden',
    'protokoll.ladefehler',
    'protokoll.navigation',
    'protokoll.ausgabe',
    'protokoll.abschnitte',
    'protokoll.felder',
    'protokoll.abschnitt1',
    'protokoll.abschnitt2',
    'protokoll.abschnitt3',
    'protokoll.abschnitt4',
    'protokoll.abschnitt5',
    'protokoll.abschnitt6',
    'protokoll.abschnitt7',
    'protokoll.regeln',
    'protokoll.speichern',
    'protokoll.sicherung',
    'protokoll.verwerfen',
    'protokoll.aenderung',
    'protokoll.abgesendet',
    'protokoll.anlagen',
    'protokoll.einlesen',
    'protokoll.absenden',
    'protokoll.entscheidung',
    'protokoll.verlauf',
    'protokoll.nurlesen',
    'protokoll.pruefung',
  ])('translates every key under %s', (namensraum) => {
    const darunter = [...deutsch.keys()].filter(
      (k) => k === namensraum || k.startsWith(`${namensraum}.`),
    )
    expect(darunter, `${namensraum} names no German text`).not.toEqual([])
    expect(darunter.filter((k) => !englisch.has(k))).toEqual([])
  })

  it('reads the placeholders it compares', () => {
    expect(platzhalter('{{sprache}} gilt, klicken Sie {{ kuerzel }}')).toEqual(['kuerzel', 'sprache'])
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
