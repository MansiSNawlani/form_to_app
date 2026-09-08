import { describe, expect, it } from 'vitest'
import { sichererWeiterPfad } from './weiter'

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
