import { describe, expect, it } from 'vitest'
import {
  fehltDieRegion,
  istRegional,
  kontoEingabe,
  kontoSchema,
  LEERES_FORMULAR,
  PASSWORT_MINDESTLAENGE,
} from './eingabe'

/* The browser half of the account rules.
 *
 * What these hold is the direction the rule runs in: this half may let something
 * through for the backend to refuse, and must never refuse something the backend
 * would have accepted.
 */

function formular(aenderungen: Partial<typeof LEERES_FORMULAR> = {}) {
  return {
    ...LEERES_FORMULAR,
    email: 'anna@ffs.de',
    passwort: 'ein-langes-passwort',
    rollen: ['SUBMITTER' as const],
    ...aenderungen,
  }
}

function fehlerFelder(eingabe: unknown): string[] {
  const ergebnis = kontoSchema.safeParse(eingabe)
  return ergebnis.success ? [] : ergebnis.error.issues.map((problem) => String(problem.path[0]))
}

describe('kontoSchema', () => {
  it('nimmt ein ausgefuelltes Formular an', () => {
    expect(kontoSchema.safeParse(formular()).success).toBe(true)
  })

  it('verlangt eine Adresse', () => {
    expect(fehlerFelder(formular({ email: '' }))).toContain('email')
  })

  it('verlangt eine Adresse, die nicht nur aus Leerzeichen besteht', () => {
    expect(fehlerFelder(formular({ email: '   ' }))).toContain('email')
  })

  it('meldet eine Adresse ohne @', () => {
    expect(fehlerFelder(formular({ email: 'anna.ffs.de' }))).toContain('email')
  })

  it('meldet eine Adresse mit einem Leerzeichen in der Mitte', () => {
    expect(fehlerFelder(formular({ email: 'anna bergmann@ffs.de' }))).toContain('email')
  })

  /* The case the browser half exists to not get wrong. The backend accepts this
     address and has a test saying so, so refusing it here would leave somebody
     unable to create an account the server would have made. */
  it('nimmt eine deutsche Adresse mit Umlaut in der Domain an', () => {
    expect(kontoSchema.safeParse(formular({ email: 'anna@fischerei-tübingen.de' })).success).toBe(
      true,
    )
  })

  it('nimmt eine Adresse mit Plus-Zeichen an', () => {
    expect(kontoSchema.safeParse(formular({ email: 'anna+ffs@ffs.de' })).success).toBe(true)
  })

  it('verlangt ein Passwort von mindestens zwoelf Zeichen', () => {
    const elf = 'a'.repeat(PASSWORT_MINDESTLAENGE - 1)
    expect(fehlerFelder(formular({ passwort: elf }))).toContain('passwort')
  })

  it('nimmt ein Passwort von genau zwoelf Zeichen an', () => {
    const zwoelf = 'a'.repeat(PASSWORT_MINDESTLAENGE)
    expect(kontoSchema.safeParse(formular({ passwort: zwoelf })).success).toBe(true)
  })

  /* A space is a legal password character and the backend stores what it is
     given, so a trim here would create an account whose password is not the one
     the administrator typed and then read out over the telephone. */
  it('laesst Leerzeichen im Passwort unangetastet', () => {
    const mitLeerzeichen = 'zwei worte hier'
    const ergebnis = kontoSchema.safeParse(formular({ passwort: mitLeerzeichen }))
    expect(ergebnis.success && ergebnis.data.passwort).toBe(mitLeerzeichen)
  })

  it('verlangt mindestens eine Rolle', () => {
    expect(fehlerFelder(formular({ rollen: [] }))).toContain('rollen')
  })

  it('nimmt mehrere Rollen an', () => {
    const mehrere = formular({ rollen: ['REVIEWER', 'DATA_STEWARD'] })
    expect(kontoSchema.safeParse(mehrere).success).toBe(true)
  })

  it('kennt keine erfundene Rolle', () => {
    expect(fehlerFelder(formular({ rollen: ['CHEF' as never] }))).toContain('rollen')
  })

  /* Nothing chosen is the Select's own empty value, and whether that is allowed
     depends on the roles rather than on this field. The coupling answers it. */
  it('nimmt ein leeres Regierungspraesidium an', () => {
    expect(kontoSchema.safeParse(formular({ regierungspraesidium: '' })).success).toBe(true)
  })

  it('haelt die Adresse ohne umgebende Leerzeichen fest', () => {
    const ergebnis = kontoSchema.safeParse(formular({ email: '  anna@ffs.de \n' }))
    expect(ergebnis.success && ergebnis.data.email).toBe('anna@ffs.de')
  })
})

/* The region coupling, which is the browser half of feature 16a's two refusals:
 * a regional role with no number, and a number on an account that has no regional
 * role. The four rows below are the four combinations the backend distinguishes.
 */
describe('kontoEingabe', () => {
  it('sendet keine Nummer fuer ein Konto ohne regionale Rolle', () => {
    const eingabe = kontoEingabe(formular({ rollen: ['SUBMITTER'] }))
    expect(eingabe?.regierungspraesidium).toBeNull()
  })

  it('sendet die gewaehlte Nummer fuer ein regionales Konto', () => {
    const eingabe = kontoEingabe(
      formular({ rollen: ['REGIERUNGSPRAESIDIUM'], regierungspraesidium: '3' }),
    )
    expect(eingabe?.regierungspraesidium).toBe(3)
  })

  it('sendet nichts, solange dem regionalen Konto die Nummer fehlt', () => {
    const eingabe = kontoEingabe(
      formular({ rollen: ['REGIERUNGSPRAESIDIUM'], regierungspraesidium: '' }),
    )
    expect(eingabe).toBeNull()
  })

  /* The case the coupling exists for. Somebody ticks the regional role, picks
     Freiburg, changes their mind and unticks it. The number is left in the form
     and must not reach the server, which would refuse it for a field that is no
     longer on the screen. */
  it('laesst eine Nummer weg, deren Rolle wieder abgewaehlt wurde', () => {
    const eingabe = kontoEingabe(
      formular({ rollen: ['SUBMITTER'], regierungspraesidium: '3' }),
    )
    expect(eingabe?.regierungspraesidium).toBeNull()
  })

  it('behaelt die Nummer, wenn die regionale Rolle neben einer anderen steht', () => {
    const eingabe = kontoEingabe(
      formular({
        rollen: ['REVIEWER', 'REGIERUNGSPRAESIDIUM'],
        regierungspraesidium: '2',
      }),
    )
    expect(eingabe?.regierungspraesidium).toBe(2)
  })

  it('gibt die uebrigen Felder unveraendert weiter', () => {
    const eingabe = kontoEingabe(
      formular({ email: 'neu@ffs.de', passwort: 'ein langes passwort', locale: 'en' }),
    )
    expect(eingabe).toMatchObject({
      email: 'neu@ffs.de',
      passwort: 'ein langes passwort',
      rollen: ['SUBMITTER'],
      locale: 'en',
    })
  })
})

describe('istRegional und fehltDieRegion', () => {
  it('erkennt die regionale Rolle', () => {
    expect(istRegional(['SUBMITTER'])).toBe(false)
    expect(istRegional(['REGIERUNGSPRAESIDIUM'])).toBe(true)
    expect(istRegional(['REVIEWER', 'REGIERUNGSPRAESIDIUM'])).toBe(true)
  })

  it('meldet die fehlende Nummer nur bei der regionalen Rolle', () => {
    expect(fehltDieRegion(['REGIERUNGSPRAESIDIUM'], '')).toBe(true)
    expect(fehltDieRegion(['REGIERUNGSPRAESIDIUM'], '1')).toBe(false)
    expect(fehltDieRegion(['SUBMITTER'], '')).toBe(false)
    /* A number left behind by a role that is no longer ticked is not a missing
       answer, so nothing is said about it. kontoEingabe drops it instead. */
    expect(fehltDieRegion(['SUBMITTER'], '3')).toBe(false)
  })
})
