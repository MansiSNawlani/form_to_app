import { describe, expect, it } from 'vitest'
import {
  ApiFehler,
  BEGRUENDUNG_FEHLT,
  EIGENES_PROTOKOLL,
  NETZWERK_FEHLER,
  UEBERGANG_NICHT_MOEGLICH,
} from '../../api/fehler'
import { entscheidungsfehler } from './entscheidungsfehler'

describe('entscheidungsfehler', () => {
  /* The one refusal a reviewer can put right by typing, so it is the one that
     belongs beside the box rather than at the top of the panel. */
  it('sends a missing Begruendung to the box', () => {
    expect(entscheidungsfehler(new ApiFehler(BEGRUENDUNG_FEHLT))).toBe('begruendung')
  })

  it('treats a transition that is no longer possible as a stale page', () => {
    expect(entscheidungsfehler(new ApiFehler(UEBERGANG_NICHT_MOEGLICH))).toBe('veraltet')
  })

  /* The rail should have prevented this one, since it never draws the panel on a
     protocol the reader filed. If it arrives anyway the server's own sentence is
     the honest answer, not a guess about how it happened. */
  it('keeps the backend sentence for deciding on your own protocol', () => {
    expect(entscheidungsfehler(new ApiFehler(EIGENES_PROTOKOLL))).toBe('sonst')
  })

  it('keeps the backend sentence for a code it has never heard of', () => {
    expect(entscheidungsfehler(new ApiFehler('IRGENDWAS_NEUES'))).toBe('sonst')
  })

  it('handles an unreachable server', () => {
    expect(entscheidungsfehler(new ApiFehler(NETZWERK_FEHLER))).toBe('sonst')
  })

  /* A bug in our own code, or whatever a library threw. Nothing here may assume
     the argument is an ApiFehler at all. */
  it('handles something that is not an API failure', () => {
    expect(entscheidungsfehler(new Error('boom'))).toBe('sonst')
    expect(entscheidungsfehler(undefined)).toBe('sonst')
  })
})
