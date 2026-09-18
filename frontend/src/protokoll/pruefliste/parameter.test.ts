import { describe, expect, it } from 'vitest'
import {
  abfrageAus,
  alsEndpunktParameter,
  alsSuchparameter,
  mitAenderung,
  OFFEN,
  STANDARD,
} from './parameter'

/** Shorthand: the query string as this screen would read it back. */
function aus(abfrage: string) {
  return abfrageAus(new URLSearchParams(abfrage))
}

/** Shorthand: what the address bar would carry, as a string. */
function adresse(...aenderungen: Parameters<typeof mitAenderung>[1][]) {
  const abfrage = aenderungen.reduce(mitAenderung, STANDARD)
  return alsSuchparameter(abfrage).toString()
}

describe('abfrageAus', () => {
  it('reads an empty address as the default selection', () => {
    expect(aus('')).toEqual(STANDARD)
    expect(STANDARD.status).toBe('offen')
  })

  it('reads every filter back out of the address', () => {
    const abfrage = aus('status=REJECTED&anlass=wrrl&jahr=2025&suche=Schussen&sortierung=gewaesser&seite=3')

    expect(abfrage).toEqual({
      status: 'REJECTED',
      anlass: 'wrrl',
      jahr: 2025,
      suche: 'Schussen',
      sortierung: 'gewaesser',
      seite: 3,
    })
  })

  /* The address bar is editable by anybody, so an unrecognised value is the
     default rather than something passed on to the endpoint, which would answer
     422 and make a hand-edited address look like a broken page. */
  it('ignores a status, an order or a year it does not recognise', () => {
    expect(aus('status=BANANE').status).toBe('offen')
    expect(aus('status=DRAFT').status).toBe('offen')
    expect(aus('sortierung=rueckwaerts').sortierung).toBe('eingereicht_alt')
    expect(aus('jahr=neulich').jahr).toBeNull()
    expect(aus('jahr=2026.5').jahr).toBeNull()
    expect(aus('jahr=0').jahr).toBeNull()
    expect(aus('jahr=99999').jahr).toBeNull()
  })

  it('reads a page below the first as the first', () => {
    expect(aus('seite=0').seite).toBe(1)
    expect(aus('seite=-3').seite).toBe(1)
    expect(aus('seite=zwei').seite).toBe(1)
  })

  it('treats a search of nothing but spaces as no search', () => {
    expect(aus('suche=%20%20%20').suche).toBe('')
  })
})

describe('alsSuchparameter', () => {
  it('writes nothing at all when everything is at its default', () => {
    expect(alsSuchparameter(STANDARD).toString()).toBe('')
  })

  it('writes only what differs from the default', () => {
    expect(adresse({ anlass: 'wrrl' })).toBe('anlass=wrrl')
    expect(adresse({ jahr: 2025 })).toBe('jahr=2025')
    expect(adresse({ status: 'alle' })).toBe('status=alle')
  })

  /* Round-trip: whatever the screen puts in the address has to read back as the
     same selection, or a reload would show a different list from the one the
     link was made on. */
  it('reads back exactly what it wrote', () => {
    const abfrage = mitAenderung(STANDARD, {
      status: 'IN_REVIEW',
      anlass: 'ffh',
      jahr: 2024,
      suche: 'Wolfegger Ach',
      sortierung: 'datum_neu',
    })

    expect(abfrageAus(alsSuchparameter(abfrage))).toEqual(abfrage)
  })
})

describe('mitAenderung', () => {
  /* Otherwise narrowing the list while on page 4 lands on a page that no longer
     exists, and the screen looks empty for a filter that matched plenty. */
  it('returns to the first page whenever a filter or the order changes', () => {
    const seite4 = mitAenderung(STANDARD, { seite: 4 })
    expect(seite4.seite).toBe(4)

    expect(mitAenderung(seite4, { anlass: 'best' }).seite).toBe(1)
    expect(mitAenderung(seite4, { suche: 'Argen' }).seite).toBe(1)
    expect(mitAenderung(seite4, { status: 'alle' }).seite).toBe(1)
    expect(mitAenderung(seite4, { jahr: 2025 }).seite).toBe(1)
    expect(mitAenderung(seite4, { sortierung: 'gewaesser' }).seite).toBe(1)
  })

  it('keeps the page when the page is what changed', () => {
    expect(mitAenderung(STANDARD, { seite: 2 }).seite).toBe(2)
  })

  /* Setting a filter to the value it already holds is not a change, so somebody
     on page 4 who reselects the order they are already using stays on page 4. */
  it('does not leave the page when nothing actually changed', () => {
    const seite4 = mitAenderung(STANDARD, { seite: 4 })
    expect(mitAenderung(seite4, { sortierung: 'eingereicht_alt' }).seite).toBe(4)
  })

  it('clamps a page below the first', () => {
    expect(mitAenderung(STANDARD, { seite: 0 }).seite).toBe(1)
  })
})

describe('alsEndpunktParameter', () => {
  /* The screen's one compound choice: the two states nobody has decided on, sent
     as the repeated parameter the endpoint takes. */
  it('expands the default selection into both open states', () => {
    expect(alsEndpunktParameter(STANDARD).getAll('status')).toEqual([...OFFEN])
  })

  it('sends no status at all for "alle"', () => {
    const parameter = alsEndpunktParameter(mitAenderung(STANDARD, { status: 'alle' }))
    expect(parameter.getAll('status')).toEqual([])
  })

  it('sends one status for one chosen state', () => {
    const parameter = alsEndpunktParameter(mitAenderung(STANDARD, { status: 'LOCKED' }))
    expect(parameter.getAll('status')).toEqual(['LOCKED'])
  })

  /* Unlike the address bar, the endpoint is sent the order and the page even
     when they are the defaults. Nobody reads this string, and spelling out what
     was asked for makes a request in the network tab answer for itself. */
  it('always names the order and the page', () => {
    const parameter = alsEndpunktParameter(STANDARD)
    expect(parameter.get('sortierung')).toBe('eingereicht_alt')
    expect(parameter.get('seite')).toBe('1')
  })

  it('leaves out a filter that is not set', () => {
    const parameter = alsEndpunktParameter(STANDARD)
    expect(parameter.has('anlass')).toBe(false)
    expect(parameter.has('jahr')).toBe(false)
    expect(parameter.has('suche')).toBe(false)
  })

  it('sends the filters that are set', () => {
    const parameter = alsEndpunktParameter(
      mitAenderung(STANDARD, { anlass: 'wrrl', jahr: 2025, suche: 'Schussen Weissenau' }),
    )

    expect(parameter.get('anlass')).toBe('wrrl')
    expect(parameter.get('jahr')).toBe('2025')
    expect(parameter.get('suche')).toBe('Schussen Weissenau')
  })

  /* Trimmed on the way out, not on the way in, so somebody typing a second word
     does not have the space eaten from under the cursor. */
  it('trims the search on the way to the endpoint', () => {
    const parameter = alsEndpunktParameter(mitAenderung(STANDARD, { suche: '  Argen  ' }))
    expect(parameter.get('suche')).toBe('Argen')
  })
})
