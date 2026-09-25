import { describe, expect, it } from 'vitest'
import { kontostatusSchluessel, regierungspraesidiumLabel } from './anzeige'

describe('regierungspraesidiumLabel', () => {
  it('reads the label out of the extracted option list', () => {
    expect(regierungspraesidiumLabel(1)).toBe('Regierungspräsidium Karlsruhe')
    expect(regierungspraesidiumLabel(4)).toBe('Regierungspräsidium Tübingen')
  })

  it('has nothing to print for an account with no region', () => {
    expect(regierungspraesidiumLabel(null)).toBeNull()
  })

  /* A fifth Regierungspraesidium shows as "5" rather than as an empty cell, so
     the row still says the account has one. */
  it('falls back to the number for a region the list does not know', () => {
    expect(regierungspraesidiumLabel(5)).toBe('5')
  })
})

describe('kontostatusSchluessel', () => {
  /* Inverted, this tells an administrator a locked account is working, which is
     the wrong answer that matters most on this screen. */
  it('says which of the two states an account is in', () => {
    expect(kontostatusSchluessel(true)).toBe('benutzerverwaltung.status.aktiv')
    expect(kontostatusSchluessel(false)).toBe('benutzerverwaltung.status.gesperrt')
  })
})
