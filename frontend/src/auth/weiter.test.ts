import { describe, expect, it } from 'vitest'
import { anmeldungsZiel, istAbgelaufen, sichererWeiterPfad } from './weiter'

describe('sichererWeiterPfad', () => {
  it('keeps a path on this site, with everything hanging off it', () => {
    expect(sichererWeiterPfad('/protokolle/neu')).toBe('/protokolle/neu')
    expect(sichererWeiterPfad('/protokolle/abc/abschnitt/4')).toBe('/protokolle/abc/abschnitt/4')
    expect(sichererWeiterPfad('/pruefung?status=offen#liste')).toBe('/pruefung?status=offen#liste')
  })

  it('refuses an absolute URL, which would send somebody off this site', () => {
    expect(sichererWeiterPfad('https://example.com/phish')).toBe('/')
    expect(sichererWeiterPfad('http://example.com')).toBe('/')
    expect(sichererWeiterPfad('javascript:alert(1)')).toBe('/')
  })

  /* The case that looks most like a path and is not one. A browser reads
     //example.com as another host, and normalises a backslash to a slash on the
     way, so all three of these leave this site. */
  it('refuses an address that only looks like a path', () => {
    expect(sichererWeiterPfad('//example.com')).toBe('/')
    expect(sichererWeiterPfad('//example.com/protokolle')).toBe('/')
    expect(sichererWeiterPfad('/\\example.com')).toBe('/')
    expect(sichererWeiterPfad('/\\/example.com')).toBe('/')
  })

  it('refuses a relative path, which could climb anywhere from here', () => {
    expect(sichererWeiterPfad('protokolle/neu')).toBe('/')
    expect(sichererWeiterPfad('../../etc')).toBe('/')
  })

  it('falls back to the home page when there is nothing to go back to', () => {
    expect(sichererWeiterPfad(null)).toBe('/')
    expect(sichererWeiterPfad(undefined)).toBe('/')
    expect(sichererWeiterPfad('')).toBe('/')
  })
})

describe('anmeldungsZiel', () => {
  it('carries the page that was asked for, encoded', () => {
    expect(anmeldungsZiel('/protokolle/neu')).toBe('/anmeldung?weiter=%2Fprotokolle%2Fneu')
    expect(anmeldungsZiel('/protokolle/abc/abschnitt/4')).toBe(
      '/anmeldung?weiter=%2Fprotokolle%2Fabc%2Fabschnitt%2F4',
    )
  })

  /* Encoded, so a target carrying its own query string comes back whole rather
     than having its parameters read as ours. */
  it('encodes a target that has a query string of its own', () => {
    expect(anmeldungsZiel('/pruefung?status=offen&art=BFOR')).toBe(
      '/anmeldung?weiter=%2Fpruefung%3Fstatus%3Doffen%26art%3DBFOR',
    )
  })

  it('carries nothing for the home page, which is where signing in lands anyway', () => {
    expect(anmeldungsZiel('/')).toBe('/anmeldung')
  })

  /* The same refusal as on the way back in. The router is where this argument
     comes from today, so this is belt and braces, but a rule that holds only
     while every caller is careful is not a rule. */
  it('refuses to carry an address that leaves this site', () => {
    expect(anmeldungsZiel('https://example.com')).toBe('/anmeldung')
    expect(anmeldungsZiel('//example.com')).toBe('/anmeldung')
  })

  it('carries the reason alongside the page, when there is one', () => {
    expect(anmeldungsZiel('/protokolle/neu', true)).toBe(
      '/anmeldung?weiter=%2Fprotokolle%2Fneu&grund=abgelaufen',
    )
  })

  /* Worth saying even to somebody who was on the home page, which is the one
     case where there is no page to carry back. */
  it('carries the reason on its own from the home page', () => {
    expect(anmeldungsZiel('/', true)).toBe('/anmeldung?grund=abgelaufen')
  })

  it('round-trips: what it writes, sichererWeiterPfad reads back unchanged', () => {
    const pfad = '/protokolle/abc/abschnitt/4'
    const ziel = new URL(anmeldungsZiel(pfad), 'https://befischung.example')

    expect(sichererWeiterPfad(ziel.searchParams.get('weiter'))).toBe(pfad)
  })
})

describe('istAbgelaufen', () => {
  it('recognises the one value it writes itself', () => {
    expect(istAbgelaufen('abgelaufen')).toBe(true)
  })

  /* The parameter is in the address bar, so anybody can put anything in it.
     Everything but the known value is ignored, which is what keeps a stranger's
     text off our login page. */
  it('ignores anything else, including something that only looks close', () => {
    expect(istAbgelaufen('Abgelaufen')).toBe(false)
    expect(istAbgelaufen('abgelaufen ')).toBe(false)
    expect(istAbgelaufen('Ihr Konto wurde gesperrt, rufen Sie 0800 123 an')).toBe(false)
    expect(istAbgelaufen('')).toBe(false)
    expect(istAbgelaufen(null)).toBe(false)
    expect(istAbgelaufen(undefined)).toBe(false)
  })
})
