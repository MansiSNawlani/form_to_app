import { describe, expect, it } from 'vitest'
import { abfrageAus, STANDARD, type Prueflistenabfrage } from './parameter'
import { prueflistenPfad, pruefungsPfad } from './pfad'

const ID = '7f1c2b90-1a2b-4c3d-9e8f-0a1b2c3d4e5f'

/** A narrowed, reordered queue on a later page: everything a link has to carry. */
const GEFILTERT: Prueflistenabfrage = {
  status: 'NEEDS_CHANGES',
  anlass: 'wrrl',
  jahr: 2025,
  suche: 'Schussen Weissenau',
  art: 'HECH',
  sortierung: 'gewaesser',
  seite: 3,
}

/** What the reviewer's screen would read back out of a path this module built. */
function gelesen(pfad: string) {
  return abfrageAus(new URLSearchParams(pfad.split('?')[1] ?? ''))
}

describe('prueflistenPfad', () => {
  it('leaves the plain queue without a query string', () => {
    // Not "/pruefung?", which would be a second spelling of the same list.
    expect(prueflistenPfad(STANDARD)).toBe('/pruefung')
  })

  it('carries a narrowed queue, page and all', () => {
    const pfad = prueflistenPfad(GEFILTERT)

    expect(pfad.startsWith('/pruefung?')).toBe(true)
    expect(gelesen(pfad)).toEqual(GEFILTERT)
  })
})

describe('pruefungsPfad', () => {
  it('opens a protocol with no query string when nothing was narrowed', () => {
    expect(pruefungsPfad(ID, STANDARD)).toBe(`/protokolle/${ID}/pruefung`)
  })

  it('carries the whole selection through to the reviewer screen', () => {
    // The round trip is the point: the screen has no list of its own, so
    // whatever this drops is a filter Vorheriges and Naechstes will not know
    // about.
    const pfad = pruefungsPfad(ID, GEFILTERT)

    expect(pfad.startsWith(`/protokolle/${ID}/pruefung?`)).toBe(true)
    expect(gelesen(pfad)).toEqual(GEFILTERT)
  })

  it('carries the species filter', () => {
    const pfad = pruefungsPfad(ID, { ...STANDARD, art: 'HECH' })

    expect(gelesen(pfad).art).toBe('HECH')
  })

  it('keeps a search term with a space in it readable back', () => {
    const pfad = pruefungsPfad(ID, { ...STANDARD, suche: '50% Bach' })

    expect(gelesen(pfad).suche).toBe('50% Bach')
  })

  it('points both paths at the same list', () => {
    // A reader who follows Pruefen and then the crumb back must land on the
    // queue they left, not on a differently filtered one.
    expect(gelesen(pruefungsPfad(ID, GEFILTERT))).toEqual(gelesen(prueflistenPfad(GEFILTERT)))
  })
})
