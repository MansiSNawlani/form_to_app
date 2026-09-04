import { describe, expect, it } from 'vitest'
import { istLeeresPaar, pruefeAusruestung } from './ausruestung'
import {
  ANODEN_PAAR,
  BREITE_PAAR,
  LAENGE_PAAR,
  ZAHLENFELDER,
} from '../abschnitte/teil5/bloecke'
import type { AntwortPfad, Antworten } from '../entwurf/typen'

/** One answer at a path, so a test can drive a field without naming its group. */
function setze(pfad: AntwortPfad, wert: string): Antworten {
  const [gruppe, schluessel] = pfad.split('.')
  return { [gruppe]: { [schluessel]: wert } } as Antworten
}

/* Part 5's three checks are one check over three pairs, so istLeeresPaar carries
   the whole of the logic and is tested on its own. pruefeAusruestung is then
   tested for what it alone decides: which pairs exist, and which field of the
   answers document each reads.

   The case that matters most is the blank pair staying silent. The legacy form
   reports it, and a literal port would have made every new draft open with three
   red messages against questions nobody has reached yet. */

describe('istLeeresPaar', () => {
  it('sagt nichts zu einem Paar, das niemand beantwortet hat', () => {
    expect(istLeeresPaar([undefined, undefined])).toBe(false)
    expect(istLeeresPaar(['', ''])).toBe(false)
    expect(istLeeresPaar(['  ', undefined])).toBe(false)
  })

  it('beanstandet zwei Nullen', () => {
    expect(istLeeresPaar(['0', '0'])).toBe(true)
  })

  it('beanstandet eine einzelne Null neben einem leeren Feld', () => {
    expect(istLeeresPaar(['0', undefined])).toBe(true)
    expect(istLeeresPaar([undefined, '0'])).toBe(true)
    expect(istLeeresPaar(['0', ''])).toBe(true)
  })

  it('laesst ein Paar zu, in dem eine der beiden Antworten etwas sagt', () => {
    expect(istLeeresPaar(['1', '0'])).toBe(false)
    expect(istLeeresPaar(['0', '2'])).toBe(false)
    expect(istLeeresPaar(['3', undefined])).toBe(false)
    expect(istLeeresPaar([undefined, '12'])).toBe(false)
    expect(istLeeresPaar(['4', '5'])).toBe(false)
  })

  it('liest sowohl Komma als auch Punkt als Dezimaltrennzeichen', () => {
    // A length can be written either way: the form is German, the input is not.
    expect(istLeeresPaar(['0,0', '0.0'])).toBe(true)
    expect(istLeeresPaar(['0,5', undefined])).toBe(false)
    expect(istLeeresPaar(['0.5', '0'])).toBe(false)
  })

  it('ueberlaesst einen Wert, der keine Zahl ist, dem Feld selbst', () => {
    // Not zero, so not this rule's business. The number input and feature 11's
    // submit gate deal with a pasted word.
    expect(istLeeresPaar(['keine', '0'])).toBe(false)
  })
})

describe('pruefeAusruestung', () => {
  it('schweigt bei einem unberuehrten Protokoll', () => {
    expect(pruefeAusruestung({})).toEqual([])
  })

  it('meldet das Anodenpaar und nennt kein Feld', () => {
    const antworten: Antworten = {
      ausruestung: { ringanoden: '0', streifenanoden: '0' },
    }

    expect(pruefeAusruestung(antworten)).toEqual([
      { pfad: ANODEN_PAAR, schluessel: 'protokoll.regeln.anodenKeine' },
    ])
  })

  it('nimmt die Anodenmeldung zurueck, sobald eine der beiden Anzahlen etwas sagt', () => {
    expect(
      pruefeAusruestung({ ausruestung: { ringanoden: '1', streifenanoden: '0' } }),
    ).toEqual([])
    expect(
      pruefeAusruestung({ ausruestung: { ringanoden: '0', streifenanoden: '2' } }),
    ).toEqual([])
  })

  /* The pairs run across the two rows, not down them. This is the legacy form's
     own pairing, kept deliberately, so it is pinned rather than left to be
     "fixed" later by someone who reads it as a bug. */
  it('paart die beiden Laengen miteinander und die beiden Breiten miteinander', () => {
    const halbeZeilen: Antworten = {
      befischte_bereiche: { ges_gew_laenge: '50', ufer_breite: '3' },
    }

    expect(pruefeAusruestung(halbeZeilen)).toEqual([])
  })

  it('meldet Laenge und Breite getrennt', () => {
    const antworten: Antworten = {
      befischte_bereiche: {
        ges_gew_laenge: '0',
        ufer_laenge: '0',
        ges_gew_breite: '4',
      },
    }

    expect(pruefeAusruestung(antworten)).toEqual([
      { pfad: LAENGE_PAAR, schluessel: 'protokoll.regeln.befischteLaengeNull' },
    ])
  })

  it('meldet alle drei Paare zusammen, wenn alle drei null sind', () => {
    const antworten: Antworten = {
      ausruestung: { ringanoden: '0', streifenanoden: '0' },
      befischte_bereiche: {
        ges_gew_laenge: '0',
        ufer_laenge: '0',
        ges_gew_breite: '0',
        ufer_breite: '0',
      },
    }

    expect(pruefeAusruestung(antworten).map(({ pfad }) => pfad)).toEqual([
      ANODEN_PAAR,
      LAENGE_PAAR,
      BREITE_PAAR,
    ])
  })

  it('ignoriert Antworten aus Teil 5, die zu keinem Paar gehoeren', () => {
    const antworten: Antworten = {
      ausruestung: { egeraet: 'FEG 3000', spannung: '0', leistung: '0' },
      anodenfuehrer: { vorname: 'Anna' },
    }

    expect(pruefeAusruestung(antworten)).toEqual([])
  })
})

/* None of part 5's nine quantities can be negative. The legacy form permits all
   of them, so this is a narrowing of ours rather than a port; see the header of
   ausruestung.ts. Unlike the pair checks it reports against the field itself,
   because there is exactly one box the wrong number is in. */
describe('die Vorzeichen von Teil 5', () => {
  it('beanstandet jede der neun Mengen, wenn sie negativ ist', () => {
    for (const pfad of ZAHLENFELDER) {
      const antworten = setze(pfad, '-1')

      expect(pruefeAusruestung(antworten)).toContainEqual({
        pfad,
        schluessel: 'protokoll.regeln.zahlNegativ',
      })
    }
  })

  it('deckt genau die neun Mengen ab', () => {
    expect(ZAHLENFELDER).toHaveLength(9)
  })

  it('laesst null und positive Werte zu', () => {
    for (const wert of ['0', '1', '0,5', '12.75', '4000']) {
      const verstoesse = pruefeAusruestung(setze('ausruestung.spannung', wert))

      expect(verstoesse).not.toContainEqual(
        expect.objectContaining({ schluessel: 'protokoll.regeln.zahlNegativ' }),
      )
    }
  })

  it('liest ein negatives Komma-Dezimal genauso wie ein Punkt-Dezimal', () => {
    expect(pruefeAusruestung(setze('befischte_bereiche.ufer_breite', '-0,5'))).toEqual([
      { pfad: 'befischte_bereiche.ufer_breite', schluessel: 'protokoll.regeln.zahlNegativ' },
    ])
  })

  it('sagt nichts zu einem leeren Feld', () => {
    expect(pruefeAusruestung(setze('ausruestung.leistung', ''))).toEqual([])
  })

  it('ueberlaesst einen Wert, der keine Zahl ist, dem Feld selbst', () => {
    // The number input rejects it, so it can only arrive by hand-editing a saved
    // draft, and Pydantic refuses it at the boundary once feature 3 lands.
    expect(pruefeAusruestung(setze('ausruestung.spannung', 'viel'))).toEqual([])
  })

  it('meldet eine negative Anzahl neben der Paarmeldung, nicht statt ihrer', () => {
    const antworten: Antworten = {
      ausruestung: { ringanoden: '-2', streifenanoden: '0' },
    }

    /* -2 is not zero, so the pair is satisfied and only the sign is wrong. The
       two rules judge different things about the same box and neither
       suppresses the other. */
    expect(pruefeAusruestung(antworten)).toEqual([
      { pfad: 'ausruestung.ringanoden', schluessel: 'protokoll.regeln.zahlNegativ' },
    ])
  })
})
