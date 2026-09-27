import { describe, expect, it } from 'vitest'
import type { BenutzerAntwort, Rolle } from '../../api/typen'
import {
  formularAusKonto,
  kontoAendernSchema,
  kontoAenderung,
  darfSperren,
  entziehtSichSuperAdmin,
  type Kontoaenderungsformular,
} from './aendern'

/* The rules behind the edit screen, held to their promises without a browser.
 *
 * Each has a way of being wrong that would be expensive:
 *
 * - formularAusKonto filling a field with the wrong value shows an administrator
 *   somebody else's answer and invites them to save it.
 * - kontoAenderung sending a field nobody touched is how two administrators
 *   editing different things overwrite each other, and leaving out the cleared
 *   region is a request the server refuses outright.
 * - entziehtSichSuperAdmin and darfSperren getting it backwards either let
 *   somebody sign themselves out with no way back, or refuse a handover that is
 *   perfectly legitimate.
 */

function konto(felder: Partial<BenutzerAntwort> = {}): BenutzerAntwort {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    email: 'anna@ffs.de',
    rollen: ['SUBMITTER'],
    regierungspraesidium: null,
    locale: 'de',
    ist_aktiv: true,
    created_at: '2026-09-01T08:00:00Z',
    ...felder,
  }
}

describe('formularAusKonto', () => {
  it('fills every field from the account', () => {
    const formular = formularAusKonto(
      konto({ email: 'bea@ffs.de', rollen: ['REVIEWER'], locale: 'en' }),
    )

    expect(formular).toEqual({
      email: 'bea@ffs.de',
      rollen: ['REVIEWER'],
      regierungspraesidium: '',
      locale: 'en',
    })
  })

  it('carries the region as the string the Select holds', () => {
    const formular = formularAusKonto(
      konto({ rollen: ['REGIERUNGSPRAESIDIUM'], regierungspraesidium: 3 }),
    )

    expect(formular.regierungspraesidium).toBe('3')
  })

  it('reads the roles in ROLLEN order however the server sent them', () => {
    const formular = formularAusKonto(konto({ rollen: ['SUPER_ADMIN', 'SUBMITTER'] }))

    expect(formular.rollen).toEqual(['SUBMITTER', 'SUPER_ADMIN'])
  })

  it('leaves out a role this build has never heard of', () => {
    // Only reachable against a newer backend. The checkbox group has no box for
    // it, so the form cannot show it; kontoAenderung is what keeps it from being
    // saved away.
    const formular = formularAusKonto(konto({ rollen: ['SUBMITTER', 'KARTOGRAF' as Rolle] }))

    expect(formular.rollen).toEqual(['SUBMITTER'])
  })
})

describe('kontoAendernSchema', () => {
  const gefuellt: Kontoaenderungsformular = {
    email: 'anna@ffs.de',
    rollen: ['SUBMITTER'],
    regierungspraesidium: '',
    locale: 'de',
  }

  it('accepts a filled form', () => {
    expect(kontoAendernSchema.safeParse(gefuellt).success).toBe(true)
  })

  it('refuses an empty address', () => {
    expect(kontoAendernSchema.safeParse({ ...gefuellt, email: '' }).success).toBe(false)
  })

  it('refuses an address that is not one', () => {
    expect(kontoAendernSchema.safeParse({ ...gefuellt, email: 'anna' }).success).toBe(false)
  })

  it('refuses an account with no roles', () => {
    expect(kontoAendernSchema.safeParse({ ...gefuellt, rollen: [] }).success).toBe(false)
  })

  it('has no password field, because a password is never part of this form', () => {
    expect('passwort' in kontoAendernSchema.shape).toBe(false)
  })
})

describe('kontoAenderung', () => {
  it('has nothing to send when nothing was touched', () => {
    const vorher = konto()

    expect(kontoAenderung(vorher, formularAusKonto(vorher))).toEqual({ art: 'unveraendert' })
  })

  it('sends the address alone when only the address changed', () => {
    const vorher = konto()
    const formular = { ...formularAusKonto(vorher), email: 'anna.neu@ffs.de' }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { email: 'anna.neu@ffs.de' },
    })
  })

  it('trims the address, because a trailing space is never meant', () => {
    const vorher = konto()
    const formular = { ...formularAusKonto(vorher), email: '  anna@ffs.de  ' }

    expect(kontoAenderung(vorher, formular)).toEqual({ art: 'unveraendert' })
  })

  it('sends the roles alone when only the roles changed', () => {
    const vorher = konto()
    const formular = { ...formularAusKonto(vorher), rollen: ['SUBMITTER', 'REVIEWER'] as Rolle[] }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { rollen: ['SUBMITTER', 'REVIEWER'] },
    })
  })

  it('does not call a reordered role list a change', () => {
    const vorher = konto({ rollen: ['SUBMITTER', 'REVIEWER'] })
    const formular = { ...formularAusKonto(vorher), rollen: ['REVIEWER', 'SUBMITTER'] as Rolle[] }

    expect(kontoAenderung(vorher, formular)).toEqual({ art: 'unveraendert' })
  })

  it('sends the language alone when only the language changed', () => {
    const vorher = konto()
    const formular = { ...formularAusKonto(vorher), locale: 'en' as const }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { locale: 'en' },
    })
  })

  it('sends the region alone when only the region changed', () => {
    const vorher = konto({ rollen: ['REGIERUNGSPRAESIDIUM'], regierungspraesidium: 2 })
    const formular = { ...formularAusKonto(vorher), regierungspraesidium: '4' }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { regierungspraesidium: 4 },
    })
  })

  /* The one that has to be right. aendere_benutzer refuses a leftover number
     rather than tidying it up, so dropping the role without clearing the number
     in the same request is a change the server rejects outright. */
  it('clears the region in the same request when the regional role goes', () => {
    const vorher = konto({
      rollen: ['SUBMITTER', 'REGIERUNGSPRAESIDIUM'],
      regierungspraesidium: 2,
    })
    const formular = { ...formularAusKonto(vorher), rollen: ['SUBMITTER'] as Rolle[] }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { rollen: ['SUBMITTER'], regierungspraesidium: null },
    })
  })

  it('sends the number with the role when the regional role arrives', () => {
    const vorher = konto()
    const formular = {
      ...formularAusKonto(vorher),
      rollen: ['SUBMITTER', 'REGIERUNGSPRAESIDIUM'] as Rolle[],
      regierungspraesidium: '1',
    }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { rollen: ['SUBMITTER', 'REGIERUNGSPRAESIDIUM'], regierungspraesidium: 1 },
    })
  })

  it('has nothing to send while the regional role has no number', () => {
    const vorher = konto()
    const formular = {
      ...formularAusKonto(vorher),
      rollen: ['REGIERUNGSPRAESIDIUM'] as Rolle[],
      regierungspraesidium: '',
    }

    expect(kontoAenderung(vorher, formular)).toEqual({ art: 'unvollstaendig' })
  })

  it('never carries ist_aktiv, which belongs to the Zugang card alone', () => {
    const vorher = konto({ ist_aktiv: false })
    const formular = { ...formularAusKonto(vorher), email: 'neu@ffs.de' }
    const ergebnis = kontoAenderung(vorher, formular)

    expect(ergebnis.art).toBe('aenderung')
    expect(ergebnis.art === 'aenderung' && 'ist_aktiv' in ergebnis.anfrage).toBe(false)
  })

  it('keeps a role this build has never heard of rather than saving it away', () => {
    const vorher = konto({ rollen: ['SUBMITTER', 'KARTOGRAF' as Rolle] })
    const formular = { ...formularAusKonto(vorher), rollen: ['SUBMITTER', 'REVIEWER'] as Rolle[] }

    expect(kontoAenderung(vorher, formular)).toEqual({
      art: 'aenderung',
      anfrage: { rollen: ['SUBMITTER', 'REVIEWER', 'KARTOGRAF'] },
    })
  })

  it('calls an account holding only an unknown role unchanged when nothing was ticked', () => {
    // The form shows no box ticked, because there is no box for that role. Saving
    // must not read the empty group as "take every role away".
    const vorher = konto({ rollen: ['KARTOGRAF' as Rolle] })

    expect(kontoAenderung(vorher, formularAusKonto(vorher))).toEqual({ art: 'unveraendert' })
  })
})

const EIGENE = 'aaaaaaaa-0000-0000-0000-000000000001'
const FREMDE = 'bbbbbbbb-0000-0000-0000-000000000002'

describe('entziehtSichSuperAdmin', () => {
  it('is true for taking SUPER_ADMIN off your own account', () => {
    const eigenes = konto({ id: EIGENE, rollen: ['SUPER_ADMIN'] })

    expect(entziehtSichSuperAdmin(eigenes, EIGENE, ['SUBMITTER'])).toBe(true)
  })

  it('is false while your own account keeps it and something else changes', () => {
    const eigenes = konto({ id: EIGENE, rollen: ['SUPER_ADMIN'] })

    expect(entziehtSichSuperAdmin(eigenes, EIGENE, ['SUPER_ADMIN', 'REVIEWER'])).toBe(false)
  })

  it('is false for taking it off somebody else, which is what a handover is', () => {
    const fremdes = konto({ id: FREMDE, rollen: ['SUPER_ADMIN'] })

    expect(entziehtSichSuperAdmin(fremdes, EIGENE, ['SUBMITTER'])).toBe(false)
  })

  it('is false while the session is still being checked', () => {
    // eigeneId is null for that one render rather than a guess, so no account is
    // treated as yours instead of the wrong one being treated as yours.
    const eigenes = konto({ id: EIGENE, rollen: ['SUPER_ADMIN'] })

    expect(entziehtSichSuperAdmin(eigenes, null, ['SUBMITTER'])).toBe(false)
  })

  it('is false for an account that was never a Super Admin', () => {
    const eigenes = konto({ id: EIGENE, rollen: ['SUBMITTER'] })

    expect(entziehtSichSuperAdmin(eigenes, EIGENE, ['REVIEWER'])).toBe(false)
  })
})

/* The other half of the same rule, and the one that decides whether a button is
   drawn at all. Inverted, it would offer somebody the one action that signs them
   out of this screen with no way back. */
describe('darfSperren', () => {
  it('refuses your own account', () => {
    expect(darfSperren(konto({ id: EIGENE }), EIGENE)).toBe(false)
  })

  it('allows an account that is not yours', () => {
    expect(darfSperren(konto({ id: FREMDE }), EIGENE)).toBe(true)
  })

  it('allows it while the session is still being checked', () => {
    // Nothing is yours for that one render, so no button is wrongly withheld.
    expect(darfSperren(konto({ id: EIGENE }), null)).toBe(true)
  })

  it('does not care what roles the account holds', () => {
    // Locking is about whose account it is, never about what it may do. The
    // last-active-Super-Admin rule is the server's and is not mirrored here.
    expect(darfSperren(konto({ id: FREMDE, rollen: ['SUPER_ADMIN'] }), EIGENE)).toBe(true)
  })
})
