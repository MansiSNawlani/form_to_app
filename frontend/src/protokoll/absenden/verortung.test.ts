import { describe, expect, it } from 'vitest'
import de from '../../i18n/locales/de.json'
import { artnummerAus, verorte } from './verortung'

/* Does this key really exist in the locale file?
 *
 * TypeScript already refuses a key that is not in de.json, so this looks like
 * belt and braces. It is not: ParseKeys is generated from the same file, so it
 * proves the spelling and not that the key resolves to a string rather than to a
 * group of keys. protokoll.abschnitt6.bemerkung.feld is a string; its sibling
 * protokoll.abschnitt6.bemerkung is an object, and printing that would put
 * "[object Object]" in front of a surveyor.
 */
function istText(schluessel: string): boolean {
  const wert = schluessel
    .split('.')
    .reduce<unknown>(
      (knoten, teil) =>
        typeof knoten === 'object' && knoten !== null
          ? (knoten as Record<string, unknown>)[teil]
          : undefined,
      de,
    )
  return typeof wert === 'string'
}

/* What a finished protocol must contain, copied from PFLICHTFELDER in
 * backend/app/protokolle/formregeln/vollstaendigkeit.py, which is the authority.
 *
 * A copy, unavoidably: the list is Python and one of its four groups is computed
 * from the hydrology block rather than written out, so nothing here could read
 * it. The count is asserted below, and the backend pins the same number on its
 * own side, so a required field added there and not mirrored here fails in both
 * places rather than quietly producing a panel entry with nowhere to go.
 */
const PFLICHTFELDER = [
  'anlass',
  'z.rp',
  'datum',
  'messdaten.uhrzeit',
  'bearbeiter.name',
  'bearbeiter.email',
  'probestrecke.gewaesser.gewaessername',
  'probestrecke.gewaessertyp',
  'probestrecke.laenge',
  'probestrecke.ortsangabe',
  'probestrecke.gewaesser.vorfluter1',
  'probestrecke.utm_rw_unten',
  'probestrecke.utm_hw_unten',
  'probestrecke.utm_rw_oben',
  'probestrecke.utm_hw_oben',
  'messdaten.temperatur',
  'messdaten.leitfaehigkeit',
  'messdaten.regenfaelle',
  'messdaten.truebung',
  'messdaten.schaumbildung',
  'hydrologie.breite',
  'hydrologie.tiefe',
  'hydrologie.tiefenvarianz',
  'hydrologie.linienfuehrung',
  'hydrologie.stroemung',
  'hydrologie.fliessgeschwindigkeit',
  'hydrologie.wasserfuehrung',
  'hydrologie.stillwasserbereich',
  'hydrologie.gesamtprofil',
  'ausruestung.egeraet',
  'ausruestung.bauweise',
]

/* The four pseudo-paths, where what is wrong is a combination rather than a
   field. Copied from app/protokolle/formregeln/regel.py, which is the authority. */
const KOMBINATIONEN = [
  'summe.umland',
  'summe.neigung',
  'summe.bewuchs',
  'summe.uferverbau',
  'summe.substrat',
  'summe.sohlverbau',
  'widerspruch.einfluesse',
  'paar.anoden',
  'paar.befischte_laenge',
  'paar.befischte_breite',
  'tabelle.arten',
]

/* At least one path out of every group the answers document has, so a whole
   group left out of the lookup fails here rather than showing up as an entry
   nobody can click. */
const AUS_JEDER_GRUPPE = [
  'anlass',
  'datum',
  'z.rp',
  'bearbeiter.name',
  'probestrecke.ortsangabe',
  'probestrecke.gewaesser.vorfluter3',
  'messdaten.temperatur',
  'hydrologie.breite',
  'umland.auwald',
  'ufer.randstreifen',
  'gewaessersohle.kolmatierte_sohle',
  'strukturen.totholz',
  'einfluesse.sonstige_nutzung_text',
  'bewirschaftung.besatz1_jahr',
  'ausruestung.spannung',
  'befischte_bereiche.ges_gew_laenge',
  'arten.art7.klasse_3',
  'bemerkungen.sonstige_bemerkungen',
  'bemerkungen.bemerkung_fische',
]

describe('verorte', () => {
  /* Pinned, so widening the required list is a deliberate act in both halves.
     11a's branch review found this list had already drifted once. */
  it('spiegelt genau die 31 Pflichtfelder des Backends', () => {
    expect(PFLICHTFELDER).toHaveLength(31)
  })

  it.each(PFLICHTFELDER)('findet das Pflichtfeld %s', (pfad) => {
    const { abschnitt, labelKey } = verorte(pfad)

    expect(abschnitt).not.toBeNull()
    expect(labelKey).not.toBeNull()
    expect(istText(labelKey as string)).toBe(true)
  })

  it.each(KOMBINATIONEN)('findet den Sammelpfad %s', (pfad) => {
    const { abschnitt, labelKey } = verorte(pfad)

    expect(abschnitt).not.toBeNull()
    expect(labelKey).not.toBeNull()
    expect(istText(labelKey as string)).toBe(true)
  })

  it.each(AUS_JEDER_GRUPPE)('findet %s, das keine Pflichtangabe ist', (pfad) => {
    // A rule can complain about any answer, not only a required one: a wrong
    // percentage and an unreadable catch cell are both violations.
    expect(verorte(pfad).abschnitt).not.toBeNull()
  })

  /* The catch table's 312 paths are recognised by shape rather than listed, so
     these prove the shape rather than any one cell. */
  it('erkennt jede Zelle der Artentabelle', () => {
    expect(verorte('arten.art1.name').abschnitt).toBe(6)
    expect(verorte('arten.art26.klasse_10').abschnitt).toBe(6)
    expect(verorte('arten.art7.0plus').abschnitt).toBe(6)
  })

  /* No label of its own. The panel names the row by the species in it, because
     "Zeile 7" would send somebody counting rows. */
  it('gibt einer Fangzelle keinen eigenen Feldnamen', () => {
    expect(verorte('arten.art7.klasse_3').labelKey).toBeNull()
  })

  /* A rule added to the backend and not here still reaches the person, with its
     message and no link. A violation nobody can see would be worse than one
     nobody can click. */
  it('verliert einen unbekannten Pfad nicht, sondern meldet ihn als unverortet', () => {
    expect(verorte('gibt.es.nicht')).toEqual({ abschnitt: null, labelKey: null })
  })

  it('haelt einen Pfad, der fast eine Fangzelle ist, nicht fuer eine', () => {
    expect(verorte('arten.art7.klasse_x').abschnitt).toBeNull()
    expect(verorte('arten.artsieben.name').abschnitt).toBeNull()
  })
})

describe('artnummerAus', () => {
  it('liest die Zeilennummer aus einer Fangzelle', () => {
    expect(artnummerAus('arten.art7.klasse_3')).toBe(7)
    expect(artnummerAus('arten.art26.0plus')).toBe(26)
  })

  it('gibt fuer alles andere nichts zurueck', () => {
    expect(artnummerAus('anlass')).toBeNull()
    expect(artnummerAus('tabelle.arten')).toBeNull()
  })
})
