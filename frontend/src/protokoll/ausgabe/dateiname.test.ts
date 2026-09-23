import { describe, expect, it } from 'vitest'
import { ERSATZNAME, dateinameAus } from './dateiname'

describe('der Dateiname aus Content-Disposition', () => {
  it('liest den prozentkodierten Namen', () => {
    expect(
      dateinameAus("attachment; filename*=UTF-8''Protokoll_Neckar_2026-08-14.pdf"),
    ).toBe('Protokoll_Neckar_2026-08-14.pdf')
  })

  it('holt Umlaute zurueck', () => {
    expect(dateinameAus("attachment; filename*=UTF-8''Protokoll_Wei%C3%9Fenau.pdf")).toBe(
      'Protokoll_Weißenau.pdf',
    )
  })

  it('versteht auch die schlichte Schreibweise', () => {
    expect(dateinameAus('attachment; filename="protokoll.pdf"')).toBe('protokoll.pdf')
  })

  it.each([
    ['ohne Kopfzeile', ''],
    ['ohne Dateinamen', 'attachment'],
    ['mit kaputter Kodierung', "attachment; filename*=UTF-8''%E0%A4%A"],
  ])('faellt %s auf den Ersatznamen zurueck', (_wie, verfuegung) => {
    expect(dateinameAus(verfuegung)).toBe(ERSATZNAME)
  })

  /* A name out of a header is data from outside, even when we wrote it: a proxy
     sits between, and the value ends up in a download attribute. */
  it.each([
    ["attachment; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd", 'passwd'],
    ['attachment; filename="..\\\\windows\\\\system32"', 'system32'],
    ["attachment; filename*=UTF-8''..", ERSATZNAME],
  ])('macht aus %s niemals einen Pfad', (verfuegung, erwartet) => {
    expect(dateinameAus(verfuegung)).toBe(erwartet)
  })
})
