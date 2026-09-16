import { describe, expect, it } from 'vitest'
import type { Rolle } from '../../api/typen'
import { ROLLEN } from '../../api/typen'
import type { Status } from '../entwurf/typen'
import { ENTSCHEIDUNGEN, brauchtBegruendung, pruefungsrail } from './entscheidungen'

const ALLE_STATUS: readonly Status[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_CHANGES',
  'REJECTED',
  'ACCEPTED',
  'LOCKED',
]

function rail(status: Status, rollen: readonly Rolle[], istEigenes = false) {
  return pruefungsrail({ status, rollen, istEigenes })
}

describe('pruefungsrail', () => {
  it('offers the panel and the pick-up to a reviewer on a submitted protocol', () => {
    expect(rail('SUBMITTED', ['REVIEWER'])).toEqual({ art: 'entscheiden', kannAufnehmen: true })
  })

  /* IN_REVIEW is decidable too. Requiring In Pruefung nehmen first would add a
     click that protects nothing, which is what the backend's own table says. */
  it('offers the panel without the pick-up once it is in Pruefung', () => {
    expect(rail('IN_REVIEW', ['REVIEWER'])).toEqual({ art: 'entscheiden', kannAufnehmen: false })
  })

  it('treats a Super Admin as a reviewer', () => {
    expect(rail('SUBMITTED', ['SUPER_ADMIN'])).toEqual({ art: 'entscheiden', kannAufnehmen: true })
  })

  it('finds the reviewer role among several', () => {
    expect(rail('IN_REVIEW', ['SUBMITTER', 'REVIEWER'])).toEqual({
      art: 'entscheiden',
      kannAufnehmen: false,
    })
  })

  /* A Data Steward corrects and quality-checks submitted data, but the yes or no
     is not theirs. They read the history and are offered no button, rather than
     one the server would refuse. */
  it('gives a Data Steward the history alone', () => {
    expect(rail('SUBMITTED', ['DATA_STEWARD'])).toEqual({ art: 'nur_verlauf' })
  })

  it('gives a plain submitter the history alone', () => {
    expect(rail('SUBMITTED', ['SUBMITTER'], true)).toEqual({ art: 'nur_verlauf' })
  })

  it('gives an account with no roles at all the history alone', () => {
    expect(rail('SUBMITTED', [])).toEqual({ art: 'nur_verlauf' })
  })

  it('tells a reviewer that their own protocol is somebody else to decide', () => {
    expect(rail('SUBMITTED', ['REVIEWER'], true)).toEqual({ art: 'eigenes' })
    expect(rail('IN_REVIEW', ['SUPER_ADMIN'], true)).toEqual({ art: 'eigenes' })
  })

  it.each(['NEEDS_CHANGES', 'REJECTED', 'ACCEPTED', 'LOCKED'] as const)(
    'tells a reviewer that a %s protocol has been decided',
    (status) => {
      expect(rail(status, ['REVIEWER'])).toEqual({ art: 'entschieden' })
    },
  )

  /* Being decided outranks having filed it. Once a protocol is locked or
     rejected the useful fact is that it is over, not that this reader could
     never have been the one to end it. */
  it('says decided rather than own protocol when both are true', () => {
    expect(rail('LOCKED', ['REVIEWER'], true)).toEqual({ art: 'entschieden' })
  })

  /* A draft never reaches this screen, which redirects it to the form. The
     function still has to answer, and "decided" would be a lie about it. */
  it('says nothing about a draft', () => {
    expect(rail('DRAFT', ['REVIEWER'])).toEqual({ art: 'nur_verlauf' })
  })

  it('answers for every status and every role without throwing', () => {
    for (const status of ALLE_STATUS) {
      for (const rolle of ROLLEN) {
        expect(rail(status, [rolle]).art).toBeTruthy()
      }
    }
  })
})

describe('brauchtBegruendung', () => {
  /* Nothing is being asked of anybody, so there is nothing to explain. The
     reviewer may still write something and the server keeps it. */
  it('does not require one for Annehmen', () => {
    expect(brauchtBegruendung('ANNEHMEN')).toBe(false)
  })

  /* Somebody else is being asked to act on the answer, or told their work is
     over. backend/app/protokolle/uebergang/regeln.py refuses both without one. */
  it('requires one for the two that go back to the submitter', () => {
    expect(brauchtBegruendung('AENDERUNG_ANFORDERN')).toBe(true)
    expect(brauchtBegruendung('ABLEHNEN')).toBe(true)
  })

  it('covers exactly the three decisions the API takes', () => {
    expect([...ENTSCHEIDUNGEN]).toEqual(['ANNEHMEN', 'AENDERUNG_ANFORDERN', 'ABLEHNEN'])
  })
})
