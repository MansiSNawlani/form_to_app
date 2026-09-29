import { describe, expect, it } from 'vitest'
import type { BenutzerAntwort } from '../../api/typen'
import { gefilterteKonten } from './suche'

function konto(email: string, ist_aktiv = true): BenutzerAntwort {
  return {
    id: email,
    email,
    rollen: ['SUBMITTER'],
    regierungspraesidium: null,
    locale: 'de',
    ist_aktiv,
    created_at: '2026-09-01T09:00:00Z',
  }
}

const KONTEN = [
  konto('anna.mueller@ffs.bwl.de'),
  konto('Bernd.Schmitt@buero-wasser.de'),
  konto('rp@rp-tuebingen.de'),
]

describe('gefilterteKonten', () => {
  it('shows every account when nothing has been typed', () => {
    expect(gefilterteKonten(KONTEN, '', 'alle')).toHaveLength(3)
    expect(gefilterteKonten(KONTEN, '   ', 'alle')).toHaveLength(3)
  })

  it('ignores case on both sides', () => {
    expect(gefilterteKonten(KONTEN, 'BERND', 'alle')).toHaveLength(1)
    expect(gefilterteKonten(KONTEN, 'bernd', 'alle')).toHaveLength(1)
  })

  /* A term pasted out of a mail client arrives with spaces round it. */
  it('ignores spaces round the term', () => {
    expect(gefilterteKonten(KONTEN, '  anna  ', 'alle')).toHaveLength(1)
  })

  /* Substring rather than prefix: "who here is from that consultancy" is a real
     question and "whose name starts with b" is not. */
  it('matches anywhere in the address, not only at the start', () => {
    expect(gefilterteKonten(KONTEN, 'ffs.bwl', 'alle')).toHaveLength(1)
    expect(gefilterteKonten(KONTEN, 'tuebingen', 'alle')).toHaveLength(1)
  })

  it('returns nothing for a term that matches nothing', () => {
    expect(gefilterteKonten(KONTEN, 'zander', 'alle')).toEqual([])
  })

  it('keeps the order the server sent', () => {
    expect(gefilterteKonten(KONTEN, '.de', 'alle').map((eintrag) => eintrag.email)).toEqual([
      'anna.mueller@ffs.bwl.de',
      'Bernd.Schmitt@buero-wasser.de',
      'rp@rp-tuebingen.de',
    ])
  })

  /* The second dimension, added on 2026-09-28. A locked account is the one an
     administrator goes looking for: somebody cannot sign in and the question is
     whether the account is locked or the password is wrong. Scrolling a list of
     tens for the one "Gesperrt" badge is what this replaces. */
  describe('by status', () => {
    const GEMISCHT = [
      konto('aktiv-1@ffs.de'),
      konto('gesperrt-1@ffs.de', false),
      konto('aktiv-2@ffs.de'),
      konto('gesperrt-2@ffs.de', false),
    ]

    it('shows everything under "alle"', () => {
      expect(gefilterteKonten(GEMISCHT, '', 'alle')).toHaveLength(4)
    })

    it('shows only the accounts that can sign in', () => {
      expect(gefilterteKonten(GEMISCHT, '', 'aktiv').map((k) => k.email)).toEqual([
        'aktiv-1@ffs.de',
        'aktiv-2@ffs.de',
      ])
    })

    it('shows only the locked ones', () => {
      expect(gefilterteKonten(GEMISCHT, '', 'gesperrt').map((k) => k.email)).toEqual([
        'gesperrt-1@ffs.de',
        'gesperrt-2@ffs.de',
      ])
    })

    /* Both at once, which is the case that would break if either filter replaced
       the other rather than narrowing what the other left. */
    it('applies the address and the status together', () => {
      expect(gefilterteKonten(GEMISCHT, 'aktiv-1', 'gesperrt')).toEqual([])
      expect(gefilterteKonten(GEMISCHT, 'gesperrt-1', 'gesperrt')).toHaveLength(1)
    })

    it('keeps the order the server sent', () => {
      expect(gefilterteKonten(GEMISCHT, '', 'aktiv').map((k) => k.email)).toEqual([
        'aktiv-1@ffs.de',
        'aktiv-2@ffs.de',
      ])
    })
  })
})
