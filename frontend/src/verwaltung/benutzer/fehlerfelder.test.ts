import { describe, expect, it } from 'vitest'
import { ApiFehler, NETZWERK_FEHLER, ROLLE_FEHLT } from '../../api/fehler'
import { feldFuerFehler } from './fehlerfelder'

/* One case per code feature 16a publishes for this endpoint, because the mapping
 * is what decides whether a sentence lands under the control it is about or
 * somewhere the reader is not looking.
 */
describe('feldFuerFehler', () => {
  it.each([
    ['EMAIL_UNGUELTIG', 'email'],
    ['EMAIL_VERGEBEN', 'email'],
    ['ROLLEN_LEER', 'rollen'],
    ['PASSWORT_ZU_KURZ', 'passwort'],
    ['PASSWORT_ZU_LANG', 'passwort'],
    ['REGIERUNGSPRAESIDIUM_FEHLT', 'regierungspraesidium'],
    ['REGIERUNGSPRAESIDIUM_UNZULAESSIG', 'regierungspraesidium'],
    ['REGIERUNGSPRAESIDIUM_UNBEKANNT', 'regierungspraesidium'],
  ])('ordnet %s dem Feld %s zu', (code, feld) => {
    expect(feldFuerFehler(new ApiFehler(code))).toBe(feld)
  })

  /* A refusal about the caller rather than about one answer. It replaces the page
     instead, so it must not be claimed by a field. */
  it('ordnet eine Ablehnung der Rolle keinem Feld zu', () => {
    expect(feldFuerFehler(new ApiFehler(ROLLE_FEHLT))).toBeUndefined()
  })

  it('ordnet einen Netzwerkfehler keinem Feld zu', () => {
    expect(feldFuerFehler(new ApiFehler(NETZWERK_FEHLER))).toBeUndefined()
  })

  it('ordnet einen unbekannten Code keinem Feld zu', () => {
    expect(feldFuerFehler(new ApiFehler('ETWAS_NEUES'))).toBeUndefined()
  })

  /* Not every failure is an ApiFehler. A thrown TypeError from our own code must
     not be read as a message about the address. */
  it('ordnet einen gewoehnlichen Fehler keinem Feld zu', () => {
    expect(feldFuerFehler(new Error('kaputt'))).toBeUndefined()
    expect(feldFuerFehler(undefined)).toBeUndefined()
    expect(feldFuerFehler(null)).toBeUndefined()
  })
})
