import { describe, expect, it } from 'vitest'
import { pruefeArten, summeAusWerten } from './arten'
import type { Antworten, Artfeld, Artnummer } from '../entwurf/typen'

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

/* A row built from the values it actually holds, so a test reads as the table
   somebody typed rather than as a nested literal. Anything left out is absent,
   which is what an untouched cell is. */
function zeile(nr: Artnummer, werte: Partial<Record<Artfeld, string>>): Antworten {
  return { arten: { [`art${nr}`]: werte } }
}

function pfade(verstoesse: readonly { pfad: string }[]): string[] {
  return verstoesse.map(({ pfad }) => pfad)
}

describe('pruefeArten, Zaehlregeln', () => {
  it('sagt zu einer unberuehrten Tabelle nichts', () => {
    expect(pruefeArten({})).toEqual([])
    expect(pruefeArten({ arten: {} })).toEqual([])
  })

  it('nimmt eine ausgefuellte Zeile ohne Einwand an', () => {
    const antworten = zeile(1, { name: 'HECH', klasse_1: '0', klasse_2: '12', '0plus': '3' })

    expect(pruefeArten(antworten)).toEqual([])
  })

  it('meldet eine negative Anzahl an der Zelle selbst', () => {
    expect(pfade(pruefeArten(zeile(1, { klasse_3: '-4' })))).toEqual([
      'arten.art1.klasse_3',
    ])
  })

  it('meldet eine Bruchzahl, ein Wort und einen Tausenderpunkt genauso', () => {
    expect(pfade(pruefeArten(zeile(2, { klasse_1: '2,5' })))).toEqual(['arten.art2.klasse_1'])
    expect(pfade(pruefeArten(zeile(2, { klasse_1: 'viele' })))).toEqual(['arten.art2.klasse_1'])
    expect(pfade(pruefeArten(zeile(2, { klasse_1: '1.200' })))).toEqual(['arten.art2.klasse_1'])
  })

  it('nennt bei jeder unmoeglichen Anzahl denselben Schluessel', () => {
    const [verstoss] = pruefeArten(zeile(1, { klasse_5: '-1' }))

    expect(verstoss.schluessel).toBe('protokoll.regeln.anzahlKeineGanzeZahl')
  })

  it('prueft auch die 0plus-Spalte auf ganze Zahlen', () => {
    expect(pfade(pruefeArten(zeile(1, { '0plus': '-2' })))).toEqual(['arten.art1.0plus'])
  })

  it('meldet 0plus, wenn es die Zeilensumme uebersteigt', () => {
    const antworten = zeile(1, { klasse_1: '2', '0plus': '7' })
    const [verstoss] = pruefeArten(antworten)

    expect(verstoss.pfad).toBe('arten.art1.0plus')
    expect(verstoss.schluessel).toBe('protokoll.regeln.nullPlusUeberSumme')
  })

  it('nimmt 0plus gleich der Zeilensumme an', () => {
    expect(pruefeArten(zeile(1, { klasse_1: '2', klasse_2: '1', '0plus': '3' }))).toEqual([])
  })

  /* A row total of nothing cannot contain three fish, so this is a real
     contradiction rather than a half-typed row. */
  it('meldet 0plus ohne jede Groessenklasse', () => {
    expect(pfade(pruefeArten(zeile(1, { name: 'HECH', '0plus': '3' })))).toEqual([
      'arten.art1.0plus',
    ])
  })

  it('sagt nichts zu einer Zeile ohne 0plus', () => {
    expect(pruefeArten(zeile(1, { klasse_1: '12' }))).toEqual([])
  })

  /* The cause gets the message, not the consequence. A row holding a word has no
     total anybody can reason from, and a second message about 0+ would bury the
     cell that actually broke it. */
  it('schweigt zu 0plus, wenn eine Klasse der Zeile unlesbar ist', () => {
    const antworten = zeile(1, { klasse_1: 'viele', '0plus': '7' })

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.klasse_1'])
  })

  it('schweigt zu 0plus, wenn eine Klasse der Zeile negativ ist', () => {
    const antworten = zeile(1, { klasse_1: '-4', klasse_2: '10', '0plus': '7' })

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.klasse_1'])
  })

  it('bleibt bei einem unmoeglichen 0plus bei einer Meldung', () => {
    const antworten = zeile(1, { klasse_1: '2', '0plus': '-7' })

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.0plus'])
  })

  it('nennt nie einen Pfad aus einer anderen Zeile', () => {
    const antworten: Antworten = {
      arten: { art1: { klasse_1: '-4' }, art2: { klasse_1: '10' } },
    }

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.klasse_1'])
  })

  /* Nothing is special-cased at either end of the table, and the rows are
     generated, so the first and the last are the two worth proving. */
  it('behandelt Zeile 26 wie Zeile 1', () => {
    expect(pfade(pruefeArten(zeile(26, { klasse_10: '-4' })))).toEqual([
      'arten.art26.klasse_10',
    ])
    expect(pfade(pruefeArten(zeile(26, { klasse_1: '2', '0plus': '7' })))).toEqual([
      'arten.art26.0plus',
    ])
  })
})

describe('pruefeArten, Artenregeln', () => {
  it('meldet eine doppelte Art nur in der zweiten Zeile', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH' }, art2: { name: 'HECH' } },
    }
    const [verstoss, ...weitere] = pruefeArten(antworten)

    expect(verstoss.pfad).toBe('arten.art2.name')
    expect(verstoss.schluessel).toBe('protokoll.regeln.artDoppelt')
    expect(weitere).toEqual([])
  })

  it('meldet die dritte Nennung ebenfalls', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH' }, art2: { name: 'HECH' }, art3: { name: 'HECH' } },
    }

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art2.name', 'arten.art3.name'])
  })

  it('haelt leere Artenfelder nicht fuer Dubletten', () => {
    const antworten: Antworten = {
      arten: { art1: { name: '' }, art2: { klasse_1: '3' }, art3: { name: '  ' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  /* The same claim made twice is still one claim, so the no-detection codes are
     ordinary entries for this rule. */
  it('meldet auch denselben kein-Nachweis-Code zweimal', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'OFAF' }, art2: { name: 'OFAF' } },
    }

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art2.name'])
  })

  /* "No fish" and "no crayfish" are two different claims, and a survey may make
     both. */
  it('nimmt zwei verschiedene kein-Nachweis-Codes nebeneinander an', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'OFAF' }, art2: { name: 'KNKR' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  it('meldet eine kein-Nachweis-Zeile, die trotzdem Tiere zaehlt', () => {
    const antworten = zeile(1, { name: 'OFAF', klasse_3: '7' })
    const [verstoss] = pruefeArten(antworten)

    expect(verstoss.pfad).toBe('arten.art1.name')
    expect(verstoss.schluessel).toBe('protokoll.regeln.keinNachweisMitFang')
  })

  it('meldet auch eine kein-Nachweis-Zeile mit 0plus', () => {
    const antworten = zeile(1, { name: 'KNMU', klasse_1: '2', '0plus': '1' })

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.name'])
  })

  it('nimmt eine kein-Nachweis-Zeile mit Nullen und leeren Zellen an', () => {
    const antworten = zeile(1, { name: 'KNKR', klasse_1: '0', klasse_2: '' })

    expect(pruefeArten(antworten)).toEqual([])
  })

  /* An unreadable cell is not a count above zero, so the cell rule reports it
     and this one stays out of the way. */
  it('schweigt zu einer kein-Nachweis-Zeile mit unlesbarer Zelle', () => {
    const antworten = zeile(1, { name: 'OFAF', klasse_1: 'viele' })

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art1.klasse_1'])
  })

  /* 2,5 is both an impossible count and a catch the row says it did not make, so
     two cells object and each says its own thing. */
  it('meldet bei einer Bruchzahl die Zelle und die Art getrennt', () => {
    const verstoesse = pruefeArten(zeile(1, { name: 'OFAF', klasse_1: '2,5' }))

    expect(pfade(verstoesse)).toEqual(['arten.art1.klasse_1', 'arten.art1.name'])
    expect(verstoesse.map(({ schluessel }) => schluessel)).toEqual([
      'protokoll.regeln.anzahlKeineGanzeZahl',
      'protokoll.regeln.keinNachweisMitFang',
    ])
  })

  /* The codes come from the picker, so they are compared exactly. A stored value
     with stray whitespace is a seed list that has drifted, and hiding it here
     would make that invisible. */
  it('normalisiert einen Artcode nicht', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH' }, art2: { name: ' HECH' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  it('meldet OFAN neben einer benannten Art', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'OFAN' }, art2: { name: 'HECH', klasse_1: '3' } },
    }
    const [verstoss, ...weitere] = pruefeArten(antworten)

    expect(verstoss.pfad).toBe('arten.art1.name')
    expect(verstoss.schluessel).toBe('protokoll.regeln.keinNachweisNebenArt')
    expect(weitere).toEqual([])
  })

  it('meldet OFAN auch, wenn die andere Art darueber steht', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH', klasse_1: '3' }, art2: { name: 'OFAN' } },
    }

    expect(pfade(pruefeArten(antworten))).toEqual(['arten.art2.name'])
  })

  it('nimmt OFAN als einzige Art an', () => {
    expect(pruefeArten(zeile(1, { name: 'OFAN' }))).toEqual([])
  })

  /* The qualified codes name what was not found, so one of them beside a species
     it does not cover is coherent. Question 10 in docs/ffs-questions.md. */
  it('laesst einen qualifizierten Code neben einer Art stehen', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'KNKR' }, art2: { name: 'HECH', klasse_1: '3' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  /* A cell can break two rules at once and can only show one message, so which
     one is decided rather than left to the resolver. */
  it('gibt je Zelle nur eine Meldung aus', () => {
    const antworten: Antworten = {
      arten: {
        art1: { name: 'HECH', klasse_1: '3' },
        art2: { name: 'OFAN' },
        art3: { name: 'OFAN' },
      },
    }
    const verstoesse = pruefeArten(antworten)

    expect(pfade(verstoesse)).toEqual(['arten.art2.name', 'arten.art3.name'])
    expect(verstoesse.map(({ schluessel }) => schluessel)).toEqual([
      'protokoll.regeln.keinNachweisNebenArt',
      'protokoll.regeln.keinNachweisNebenArt',
    ])
  })
})

describe('pruefeArten, kein-Nachweis-Regel der Tabelle', () => {
  it('sagt zu einer Tabelle ohne jede Zahl nichts', () => {
    expect(pruefeArten(zeile(1, { name: 'HECH' }))).toEqual([])
  })

  it('meldet eine benannte Art, bei der alles ausdruecklich null ist', () => {
    const antworten = zeile(1, { name: 'HECH', klasse_1: '0', klasse_2: '0' })
    const [verstoss, ...weitere] = pruefeArten(antworten)

    expect(verstoss.pfad).toBe('tabelle.arten')
    expect(verstoss.schluessel).toBe('protokoll.regeln.fangOhneNachweisCode')
    expect(weitere).toEqual([])
  })

  it('schweigt, sobald irgendwo etwas gefangen wurde', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH', klasse_1: '0' }, art2: { name: 'ANGU', klasse_1: '2' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  /* The table has already said it, which is the correction this rule asks for. */
  it('schweigt, wenn eine kein-Nachweis-Zeile daneben steht', () => {
    const antworten: Antworten = {
      arten: { art1: { name: 'HECH', klasse_1: '0' }, art2: { name: 'KNKR' } },
    }

    expect(pruefeArten(antworten)).toEqual([])
  })

  it('schweigt zu einer Nullzeile ohne benannte Art', () => {
    expect(pruefeArten(zeile(1, { klasse_1: '0' }))).toEqual([])
  })

  /* A table whose counts cannot be trusted is not evidence that nothing was
     caught, and the cell has its own message. */
  it('schweigt, wenn eine Zelle unlesbar oder negativ ist', () => {
    expect(pfade(pruefeArten(zeile(1, { name: 'HECH', klasse_1: '0', klasse_2: 'viele' })))).toEqual([
      'arten.art1.klasse_2',
    ])
    expect(pfade(pruefeArten(zeile(1, { name: 'HECH', klasse_1: '0', klasse_2: '-1' })))).toEqual([
      'arten.art1.klasse_2',
    ])
  })

  it('zaehlt auch eine ausdrueckliche Null in 0plus als Angabe', () => {
    expect(pfade(pruefeArten(zeile(1, { name: 'HECH', '0plus': '0' })))).toEqual([
      'tabelle.arten',
    ])
  })
})
