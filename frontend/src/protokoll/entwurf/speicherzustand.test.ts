import { describe, expect, it } from 'vitest'
import { anzeigeZustand } from './speicherzustand'

/* The header carries one indicator for the whole protocol, so this decides what
   it says when the answers and the attachments each have something to report.
   The costly mistakes are both of the same kind: hiding a problem behind a
   cheerful "gespeichert". */

const FRUEH = '2026-09-11T09:14:00.000Z'
const SPAET = '2026-09-11T09:20:00.000Z'

describe('anzeigeZustand', () => {
  it('says nothing new when the attachments have nothing to say', () => {
    expect(anzeigeZustand({ status: 'unchanged' }, null)).toEqual({ status: 'unchanged' })
    expect(anzeigeZustand({ status: 'saved', zeitpunkt: FRUEH }, null)).toEqual({
      status: 'saved',
      zeitpunkt: FRUEH,
    })
  })

  /* Anything in flight wins. Somebody watching wants to know work is being done
     before they want to know when it was last done. */
  it('reports a photograph going up as saving, whatever the form says', () => {
    expect(
      anzeigeZustand({ status: 'saved', zeitpunkt: FRUEH }, { status: 'saving' }),
    ).toEqual({ status: 'saving' })
    expect(anzeigeZustand({ status: 'unchanged' }, { status: 'saving' })).toEqual({
      status: 'saving',
    })
  })

  it('still reports the form saving when the attachments are idle', () => {
    expect(anzeigeZustand({ status: 'saving' }, null)).toEqual({ status: 'saving' })
  })

  /* The one that matters most. A conflict is the single save failure a person
     has to act on rather than wait out, and a photograph arriving a moment later
     must never be what covers it up. */
  it('never lets a landed photograph hide a conflict', () => {
    expect(
      anzeigeZustand({ status: 'conflict' }, { status: 'saved', zeitpunkt: SPAET }),
    ).toEqual({ status: 'conflict' })
  })

  it('never lets a landed photograph hide a failed save', () => {
    expect(
      anzeigeZustand({ status: 'failed' }, { status: 'saved', zeitpunkt: SPAET }),
    ).toEqual({ status: 'failed' })
  })

  it('shows whichever happened last', () => {
    expect(
      anzeigeZustand(
        { status: 'saved', zeitpunkt: SPAET },
        { status: 'saved', zeitpunkt: FRUEH },
      ),
    ).toEqual({ status: 'saved', zeitpunkt: SPAET })

    expect(
      anzeigeZustand(
        { status: 'saved', zeitpunkt: FRUEH },
        { status: 'saved', zeitpunkt: SPAET },
      ),
    ).toEqual({ status: 'saved', zeitpunkt: SPAET })
  })

  /* The case that prompted the whole function: somebody opens a new protocol,
     goes straight to section 7 and attaches a photograph. The form has never
     saved anything, so on its own it would go on saying "noch nicht
     gespeichert" beside a picture sitting on the server. */
  it('reports a photograph landing on a protocol whose answers were never saved', () => {
    expect(
      anzeigeZustand({ status: 'ungespeichert' }, { status: 'saved', zeitpunkt: FRUEH }),
    ).toEqual({ status: 'saved', zeitpunkt: FRUEH })
  })

  it('reports a photograph landing on a protocol with no changes since it opened', () => {
    expect(
      anzeigeZustand({ status: 'unchanged' }, { status: 'saved', zeitpunkt: FRUEH }),
    ).toEqual({ status: 'saved', zeitpunkt: FRUEH })
  })

  /* A refused file reports nothing at all, so the header keeps saying whatever
     was true before. The block is already naming the file and what to do about
     it, and the answers really are safe: two messages for one event is how the
     useful one gets missed. */
  it('leaves the header alone when a pick was refused outright', () => {
    expect(anzeigeZustand({ status: 'saved', zeitpunkt: FRUEH }, null)).toEqual({
      status: 'saved',
      zeitpunkt: FRUEH,
    })
    expect(anzeigeZustand({ status: 'ungespeichert' }, null)).toEqual({
      status: 'ungespeichert',
    })
  })
})
