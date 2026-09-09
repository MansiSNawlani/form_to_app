import { describe, expect, it } from 'vitest'
import {
  anlassLabel,
  bearbeitetAnzeige,
  datumAnzeige,
  statusAnzeige,
  unterzeile,
  zaehlungen,
} from './anzeige'
import type { Status, Uebersicht } from '../entwurf/typen'

function zeile(teile: Partial<Uebersicht> = {}): Uebersicht {
  return {
    id: 'a1',
    status: 'DRAFT',
    form_version: '20260609',
    version: 1,
    created_at: '2026-08-14T08:00:00Z',
    updated_at: '2026-08-14T08:00:00Z',
    gewaessername: 'Schussen',
    ortsangabe: 'Weißenau',
    laenge: '120',
    datum: '2026-08-14',
    anlass: null,
    ...teile,
  }
}

/* Built from local parts rather than from an ISO string with an offset, so the
   test asserts the same thing in every timezone the machine running it might be
   set to. What is under test is "is this the same calendar day as now", and that
   is a local question. */
function ortszeit(jahr: number, monat: number, tag: number, stunde = 0, minute = 0) {
  return new Date(jahr, monat - 1, tag, stunde, minute)
}

describe('datumAnzeige', () => {
  it('prints the stored day the way the form does', () => {
    expect(datumAnzeige('2026-08-14')).toBe('14.08.2026')
  })

  /* A draft is incomplete by definition, so most rows in a young list have no
     survey date yet. The cell stays empty rather than inventing one. */
  it('has nothing to print for a day nobody has entered', () => {
    expect(datumAnzeige(null)).toBeNull()
  })

  /* Answers are free text on the way in and this document survives across form
     versions, so a value that is not a date at all has to be possible to
     render. Printing "Invalid Date" at a surveyor is worse than printing
     nothing. */
  it('has nothing to print for something that is not a date', () => {
    expect(datumAnzeige('irgendwann')).toBeNull()
    expect(datumAnzeige('2026-13-40')).toBeNull()
    expect(datumAnzeige('')).toBeNull()
  })
})

describe('bearbeitetAnzeige', () => {
  const jetzt = ortszeit(2026, 8, 14, 16, 5)

  it('says the time alone for something touched today', () => {
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 14, 14, 32).toISOString(), jetzt)).toEqual({
      art: 'heute',
      zeit: '14:32',
    })
  })

  it('says the time alone for yesterday too, and names the day', () => {
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 13, 9, 5).toISOString(), jetzt)).toEqual({
      art: 'gestern',
      zeit: '09:05',
    })
  })

  it('falls back to the plain date for anything older', () => {
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 11, 9, 5).toISOString(), jetzt)).toEqual({
      art: 'datum',
      datum: '11.08.2026',
    })
  })

  /* The two edges of "today", because an off-by-one here would print "gestern"
     on something saved a minute ago. */
  it('counts midnight this morning as today and the minute before it as yesterday', () => {
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 14, 0, 0).toISOString(), jetzt)).toMatchObject({
      art: 'heute',
    })
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 13, 23, 59).toISOString(), jetzt)).toMatchObject({
      art: 'gestern',
    })
  })

  it('counts midnight yesterday morning as yesterday and the minute before it as older', () => {
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 13, 0, 0).toISOString(), jetzt)).toMatchObject({
      art: 'gestern',
    })
    expect(bearbeitetAnzeige(ortszeit(2026, 8, 12, 23, 59).toISOString(), jetzt)).toMatchObject({
      art: 'datum',
    })
  })

  it('has nothing to print for a timestamp it cannot read', () => {
    expect(bearbeitetAnzeige('nie', jetzt)).toBeNull()
  })
})

describe('unterzeile', () => {
  it('puts the place and the length on one line', () => {
    expect(unterzeile('Weißenau', '120')).toBe('Weißenau · 120 m')
  })

  it('drops whichever half is missing rather than leaving a stray separator', () => {
    expect(unterzeile('Weißenau', null)).toBe('Weißenau')
    expect(unterzeile(null, '120')).toBe('120 m')
    expect(unterzeile(null, null)).toBeNull()
  })

  /* The length is a form answer, so it is text and can hold anything somebody
     typed. It is printed as given rather than parsed, but a value that is only
     whitespace is nothing. */
  it('treats a blank as nothing', () => {
    expect(unterzeile('   ', '  ')).toBeNull()
  })
})

describe('anlassLabel', () => {
  /* The stored value is a code and the person reading the list has never seen
     it. The label comes from the same option list the form's own dropdown
     reads, so the two can never disagree. */
  it('shows the label the form offers for the stored code', () => {
    expect(anlassLabel('best')).toBe('allgemeine Bestandserhebung')
  })

  /* A protocol is never migrated to a later form version (ADR 0004), so a draft
     can hold a code that today's list no longer offers. Showing the raw code is
     worse than a label and much better than an empty cell. */
  it('falls back to the stored code when no option matches it', () => {
    expect(anlassLabel('gibt-es-nicht')).toBe('gibt-es-nicht')
  })

  it('has nothing to print when no occasion was chosen', () => {
    expect(anlassLabel(null)).toBeNull()
  })
})

describe('statusAnzeige', () => {
  const alle: Status[] = [
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'NEEDS_CHANGES',
    'REJECTED',
    'ACCEPTED',
    'LOCKED',
  ]

  /* Feature 11 turns the other six on. A status with no entry here would render
     as an empty badge, which reads as "no status" rather than as a mistake, so
     the completeness is checked rather than assumed. */
  it('has a label and a colour for every status the backend can send', () => {
    for (const status of alle) {
      const anzeige = statusAnzeige(status)
      expect(anzeige.schluessel).toBe(`protokolle.list.status.${status}`)
      expect(anzeige.farbe).toBeTruthy()
    }
  })

  it('separates the states a person must act on from the ones they need not', () => {
    expect(statusAnzeige('NEEDS_CHANGES').farbe).toBe('warn')
    expect(statusAnzeige('REJECTED').farbe).toBe('danger')
    expect(statusAnzeige('ACCEPTED').farbe).toBe('ok')
    expect(statusAnzeige('DRAFT').farbe).toBe('neutral')
  })
})

describe('zaehlungen', () => {
  it('counts the protocols and, separately, the drafts among them', () => {
    expect(
      zaehlungen([zeile(), zeile({ status: 'SUBMITTED' }), zeile({ status: 'ACCEPTED' })]),
    ).toEqual({ gesamt: 3, entwuerfe: 1 })
  })

  it('counts an empty list as nothing at all', () => {
    expect(zaehlungen([])).toEqual({ gesamt: 0, entwuerfe: 0 })
  })
})
