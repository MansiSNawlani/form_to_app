import { describe, expect, it } from 'vitest'
import de from '../../i18n/locales/de.json'
import { UNBRAUCHBAR_SCHLUESSEL } from '../absenden/gruppierung'

/* Every string this feature can put on a screen, pinned to the locale file.
 *
 * The same belt and braces verortung.test.ts wears, for the same reason.
 * TypeScript refuses a key that is not in de.json, but ParseKeys is generated
 * from that very file, so the type proves the spelling and not that the key
 * resolves to a string. A key naming a group rather than a string compiles
 * perfectly and prints "[object Object]" at a surveyor.
 *
 * It also catches the case this feature actually invites. UNBRAUCHBAR_SCHLUESSEL
 * is a plain string constant rather than a ParseKeys, because gruppierung.ts
 * hands it out as a message key beside the backend's own and those arrive as
 * strings. Nothing but this test would notice it being renamed on one side only.
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

/* A plural key is stored as _one and _other rather than under its own name, so
   it is checked through both of its real spellings. */
function istPluralText(schluessel: string): boolean {
  return istText(`${schluessel}_one`) && istText(`${schluessel}_other`)
}

/** The control and its three states, on Meine Protokolle. */
const LISTENSCHLUESSEL = [
  'protokolle.einlesen.waehlen',
  'protokolle.einlesen.laeuft',
  'protokolle.einlesen.laeuftHinweis',
  'protokolle.einlesen.fehler.titel',
  'protokolle.einlesen.fehler.titelMitDatei',
  'protokolle.einlesen.fehler.text',
  'protokolle.einlesen.fehler.schliessen',
]

/** What the import says inside the protocol. */
const PROTOKOLLSCHLUESSEL = [
  'protokoll.einlesen.banner.titel',
  'protokoll.einlesen.banner.text',
  'protokoll.einlesen.unbrauchbar.titel',
  'protokoll.einlesen.unbrauchbar.text',
]

/** The picture count, which is counted and therefore plural. */
const PLURALSCHLUESSEL = ['protokoll.einlesen.bilder.titel', 'protokoll.einlesen.bilder.text']

describe('die deutschen Texte des Imports', () => {
  it.each(LISTENSCHLUESSEL)('hat einen Text fuer %s', (schluessel) => {
    expect(istText(schluessel)).toBe(true)
  })

  it.each(PROTOKOLLSCHLUESSEL)('hat einen Text fuer %s', (schluessel) => {
    expect(istText(schluessel)).toBe(true)
  })

  it.each(PLURALSCHLUESSEL)('hat Einzahl und Mehrzahl fuer %s', (schluessel) => {
    expect(istPluralText(schluessel)).toBe(true)
  })

  /* gruppierung.ts hands this out as a message key, so a rename on one side
     alone would print the key itself in the panel. */
  it('hat einen Text fuer den Schluessel, den gruppierung.ts vergibt', () => {
    expect(istText(UNBRAUCHBAR_SCHLUESSEL)).toBe(true)
  })

  /* The file's version is interpolated into the banner, so the placeholder has
     to survive a reword. Without it the sentence still reads, and silently stops
     saying which template was filled in. */
  it('nennt im Hinweis den Formularstand der Datei', () => {
    const text = de.protokoll.einlesen.banner.text
    expect(text).toContain('{{quellversion}}')
  })

  /* The refusal names the file back to the person, which is the whole reason
     there are two titles rather than one: a surveyor who picked the wrong PDF
     out of a folder of four needs to be told which of them this is about. */
  it('nennt in der Ablehnung den Dateinamen', () => {
    expect(de.protokolle.einlesen.fehler.titelMitDatei).toContain('{{dateiname}}')
  })
})
