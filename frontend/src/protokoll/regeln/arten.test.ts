import { describe, expect, it } from 'vitest'
import { summeAusWerten } from './arten'

/* The arithmetic behind the Σ cell and the Gesamtsumme.
 *
 * The legacy form calculates both with AFSimple_Calculate("SUM", ...) and marks
 * the result read-only, so they are derived here too and never stored. That
 * makes this worth testing on its own: it is the only thing standing between a
 * surveyor and a total that disagrees with the cells above it.
 *
 * The 0+ column never reaches this function. Which values make up a total is
 * decided by the callers, and both of them pass the ten size classes only,
 * because the printed form heads that column "davon" and those individuals are
 * already counted in the classes beside them.
 */

describe('summeAusWerten', () => {
  it('zaehlt nichts als 0', () => {
    expect(summeAusWerten([])).toBe(0)
    expect(summeAusWerten(['', undefined, '  '])).toBe(0)
  })

  it('addiert die angegebenen Zahlen', () => {
    expect(summeAusWerten(['12', '30', '', '1'])).toBe(43)
  })

  it('ignoriert Leerzeichen um eine Zahl', () => {
    expect(summeAusWerten([' 5 ', '', '7'])).toBe(12)
  })

  it('unterscheidet nicht zwischen leer und ausdruecklich null', () => {
    // The "no detection" rule in 9b turns on the total being exactly 0, so a
    // table filled in with zeros must reach the same number as an empty one.
    expect(summeAusWerten(['0', '0'])).toBe(0)
  })

  it('zaehlt negative Zahlen mit, statt sie zu verschweigen', () => {
    // 9b objects to the sign. Until then the total still has to describe what
    // was typed, or the message and the number would tell different stories.
    expect(summeAusWerten(['-4', '10'])).toBe(6)
  })

  it('meldet undefined, wenn eine Zelle keine Zahl ist', () => {
    expect(summeAusWerten(['12', 'viele'])).toBeUndefined()
  })

  /* A count is a number of individuals. 2,5 Bachforellen is not a smaller answer
     than 3, it is not an answer, so the total says it cannot be worked out
     rather than inventing a half fish. */
  it('lehnt Bruchzahlen ab, weil man keine halben Fische faengt', () => {
    expect(summeAusWerten(['2,5', '1'])).toBeUndefined()
    expect(summeAusWerten(['2.5'])).toBeUndefined()
  })

  /* The one that would silently lose 999 fish. alsZahl reads the dot as a
     decimal point, so a hand-edited "1.200" comes back as 1.2. Rejecting
     fractions catches it, which is why that rule is worth more than tidiness. */
  it('faellt nicht auf einen deutschen Tausenderpunkt herein', () => {
    expect(summeAusWerten(['1.200'])).toBeUndefined()
  })

  it('nimmt grosse ganze Zahlen an', () => {
    expect(summeAusWerten(['1200', '800'])).toBe(2000)
  })
})
