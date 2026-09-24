import { describe, expect, it } from 'vitest'
import type { BenutzerAntwort } from '../../api/typen'
import { gefilterteKonten } from './suche'

function konto(email: string): BenutzerAntwort {
  return {
    id: email,
    email,
    rollen: ['SUBMITTER'],
    regierungspraesidium: null,
    locale: 'de',
    ist_aktiv: true,
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
    expect(gefilterteKonten(KONTEN, '')).toHaveLength(3)
    expect(gefilterteKonten(KONTEN, '   ')).toHaveLength(3)
  })

  it('ignores case on both sides', () => {
    expect(gefilterteKonten(KONTEN, 'BERND')).toHaveLength(1)
    expect(gefilterteKonten(KONTEN, 'bernd')).toHaveLength(1)
  })

  /* A term pasted out of a mail client arrives with spaces round it. */
  it('ignores spaces round the term', () => {
    expect(gefilterteKonten(KONTEN, '  anna  ')).toHaveLength(1)
  })

  /* Substring rather than prefix: "who here is from that consultancy" is a real
     question and "whose name starts with b" is not. */
  it('matches anywhere in the address, not only at the start', () => {
    expect(gefilterteKonten(KONTEN, 'ffs.bwl')).toHaveLength(1)
    expect(gefilterteKonten(KONTEN, 'tuebingen')).toHaveLength(1)
  })

  it('returns nothing for a term that matches nothing', () => {
    expect(gefilterteKonten(KONTEN, 'zander')).toEqual([])
  })

  it('keeps the order the server sent', () => {
    expect(gefilterteKonten(KONTEN, '.de').map((eintrag) => eintrag.email)).toEqual([
      'anna.mueller@ffs.bwl.de',
      'Bernd.Schmitt@buero-wasser.de',
      'rp@rp-tuebingen.de',
    ])
  })
})
