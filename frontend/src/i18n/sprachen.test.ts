import { describe, expect, it } from 'vitest'
import { SPRACHEN, SUPPORTED_LOCALES, localeFuer, spracheFuer } from './sprachen'

describe('SPRACHEN', () => {
  it('has a complete entry for every supported locale', () => {
    expect(Object.keys(SPRACHEN).sort()).toEqual([...SUPPORTED_LOCALES].sort())

    for (const locale of SUPPORTED_LOCALES) {
      const sprache = SPRACHEN[locale]
      expect(sprache.name).not.toBe('')
      expect(sprache.dayjs).not.toBe('')
      expect(sprache.mui).toBeTypeOf('object')
      expect(sprache.datumsauswahl.okButtonLabel).toBeTypeOf('string')
    }
  })

  /* en-GB rather than en-US: day before month and a 24 hour clock, which is what
     a reader in Baden-Wuerttemberg expects. A US date would read 03/04 as 4 March. */
  it('formats German as de-DE and English as en-GB', () => {
    expect(SPRACHEN.de.format).toBe('de-DE')
    expect(SPRACHEN.en.format).toBe('en-GB')

    const moment = new Date(2026, 8, 30, 14, 5)
    const zeit = (locale: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(moment)
    expect(zeit(SPRACHEN.en.format)).toBe('30/09/2026, 14:05')
    expect(zeit(SPRACHEN.de.format)).toBe('30.09.26, 14:05')
  })

  it('names each language in that language', () => {
    expect(SPRACHEN.de.name).toBe('Deutsch')
    expect(SPRACHEN.en.name).toBe('English')
  })

  /* MUI is English out of the box, so its English locale is empty on purpose and
     only German has to carry texts. */
  it('gives MUI and the date pickers their own texts per language', () => {
    expect(SPRACHEN.de.mui.components?.MuiTablePagination).toBeDefined()
    expect(SPRACHEN.de.datumsauswahl.cancelButtonLabel).toBe('Abbrechen')
    expect(SPRACHEN.en.datumsauswahl.cancelButtonLabel).toBe('Cancel')
  })
})

describe('spracheFuer', () => {
  it('finds the row for a supported locale', () => {
    expect(spracheFuer('en')).toBe(SPRACHEN.en)
    expect(spracheFuer('de')).toBe(SPRACHEN.de)
  })

  it('falls back to German for anything else', () => {
    expect(spracheFuer('fr')).toBe(SPRACHEN.de)
    expect(spracheFuer('')).toBe(SPRACHEN.de)
    expect(localeFuer('en-US')).toBe('de')
    expect(localeFuer('en')).toBe('en')
  })
})
