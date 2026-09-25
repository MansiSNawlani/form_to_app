import { describe, expect, it } from 'vitest'
import { prueflisteKey } from './abfragen'
import { mitAenderung, STANDARD } from './parameter'

describe('prueflisteKey', () => {
  /* Two selections that ask the server the same question are one cached answer.
     Keyed on the selection object instead, these would be two entries holding
     identical rows. */
  it('is the same key for two selections the endpoint cannot tell apart', () => {
    const eine = mitAenderung(STANDARD, { suche: 'Argen' })
    const andere = mitAenderung(STANDARD, { suche: '  Argen  ' })

    expect(prueflisteKey(eine)).toEqual(prueflisteKey(andere))
  })

  it('is a different key for a different page and for a different filter', () => {
    expect(prueflisteKey(mitAenderung(STANDARD, { seite: 2 }))).not.toEqual(
      prueflisteKey(STANDARD),
    )
    expect(prueflisteKey(mitAenderung(STANDARD, { status: 'alle' }))).not.toEqual(
      prueflisteKey(STANDARD),
    )
  })
})
