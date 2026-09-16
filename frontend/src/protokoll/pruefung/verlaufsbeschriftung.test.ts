import { describe, expect, it } from 'vitest'
import type { Status } from '../entwurf/typen'
import { verlaufsbeschriftung } from './verlaufsbeschriftung'

describe('verlaufsbeschriftung', () => {
  /* What happened is read from where the protocol ended up, never from where it
     came from: a re-submission after a correction is Eingereicht again, which is
     right, because it is the same action. */
  it('names each move by the state it produced', () => {
    expect(verlaufsbeschriftung('SUBMITTED')).toBe('protokoll.verlauf.aktion.SUBMITTED')
    expect(verlaufsbeschriftung('IN_REVIEW')).toBe('protokoll.verlauf.aktion.IN_REVIEW')
    expect(verlaufsbeschriftung('NEEDS_CHANGES')).toBe('protokoll.verlauf.aktion.NEEDS_CHANGES')
    expect(verlaufsbeschriftung('REJECTED')).toBe('protokoll.verlauf.aktion.REJECTED')
    expect(verlaufsbeschriftung('LOCKED')).toBe('protokoll.verlauf.aktion.LOCKED')
  })

  /* Neither is written by anything today: no event is recorded when a draft is
     created, and Annehmen goes straight to LOCKED. Both are in the enum, so both
     need a word rather than a hole in a list somebody is reading. */
  it('has a word for the two states nothing writes', () => {
    expect(verlaufsbeschriftung('DRAFT')).toBe('protokoll.verlauf.aktion.DRAFT')
    expect(verlaufsbeschriftung('ACCEPTED')).toBe('protokoll.verlauf.aktion.ACCEPTED')
  })

  /* A backend newer than this build can send a state this one has never heard
     of. A generic sentence is worth having; a raw key printed at a reviewer is
     not. */
  it('falls back to something readable for a state it does not know', () => {
    const unbekannt = 'ABGELAUFEN' as Status

    expect(verlaufsbeschriftung(unbekannt)).toBe('protokoll.verlauf.aktion.unbekannt')
  })
})
