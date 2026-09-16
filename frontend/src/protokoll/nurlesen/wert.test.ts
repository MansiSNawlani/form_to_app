import { describe, expect, it } from 'vitest'
import { angezeigterWert } from './wert'

describe('angezeigterWert', () => {
  it('gibt eine Antwort unverändert zurück', () => {
    expect(angezeigterWert('Wolfegger Ach')).toBe('Wolfegger Ach')
  })

  it('behandelt eine nie berührte Antwort als unbeantwortet', () => {
    expect(angezeigterWert(undefined)).toBeNull()
  })

  it('behandelt null als unbeantwortet', () => {
    // Nothing in the answers document stores null today, but the envelope fields
    // beside it do, and one component reading both must not crash on it.
    expect(angezeigterWert(null)).toBeNull()
  })

  it('behandelt ein geleertes Feld als unbeantwortet', () => {
    // What a text field stores once somebody has typed into it and deleted it
    // again. To a reader that is the same as never having touched it.
    expect(angezeigterWert('')).toBeNull()
  })

  it('behandelt reine Leerzeichen als unbeantwortet', () => {
    expect(angezeigterWert('   ')).toBeNull()
  })

  it('zeigt die Null an, statt sie für leer zu halten', () => {
    // The point of the whole function. "0" is falsy in JavaScript and is a real
    // answer all over this form: no fish of that size class, no share of that
    // bank type. Printing "nicht angegeben" here would tell a reviewer the
    // surveyor skipped a field they actually answered.
    expect(angezeigterWert('0')).toBe('0')
  })

  it('beschneidet die Ränder, nicht die Mitte', () => {
    expect(angezeigterWert('  110  ')).toBe('110')
    expect(angezeigterWert(' erste Zeile\nzweite Zeile ')).toBe(
      'erste Zeile\nzweite Zeile',
    )
  })
})
