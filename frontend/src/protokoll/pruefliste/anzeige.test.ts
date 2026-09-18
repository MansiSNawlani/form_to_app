import { describe, expect, it } from 'vitest'
import { unterzeile } from './anzeige'

describe('unterzeile', () => {
  it('joins all three parts when the stretch has a monitoring number', () => {
    expect(unterzeile('Weissenau, oberhalb der Bruecke', 120, 'MST 12345')).toBe(
      'Weissenau, oberhalb der Bruecke · 120 m · MST 12345',
    )
  })

  /* Most stretches have no monitoring number, so this is the ordinary row rather
     than the exception. A trailing separator here would read as a value that
     failed to load. */
  it('leaves out the monitoring number, and its separator, when there is none', () => {
    expect(unterzeile('Weissenau', 120, null)).toBe('Weissenau · 120 m')
  })

  it('leaves out a missing length the same way', () => {
    expect(unterzeile('Weissenau', null, 'MST 12345')).toBe('Weissenau · MST 12345')
    expect(unterzeile('Weissenau', null, null)).toBe('Weissenau')
  })

  /* A blank Ortsangabe cannot happen on a handed-in protocol, since the envelope
     is required the moment one leaves DRAFT. It is handled anyway, because this
     screen must survive a row it did not expect rather than print a line
     starting with a dot. */
  it('survives an empty Ortsangabe', () => {
    expect(unterzeile('', 120, 'MST 12345')).toBe('120 m · MST 12345')
    expect(unterzeile('   ', null, null)).toBeNull()
  })

  it('prints a zero length rather than dropping it', () => {
    expect(unterzeile('Weissenau', 0, null)).toBe('Weissenau · 0 m')
  })
})
