import optionslisten from '@formular/optionslisten.json'
import { describe, expect, it } from 'vitest'
import { optionLabel, optionLabelMitWert, optionen, type Option } from './optionen'

/* The legacy form's E-Gerät list offers the same answer under two names, and a
   control that repeats an answer is a control where picking one thing and
   getting the other back is possible. See docs/ffs-defect-list.md item 12.

   These tests pin both halves of the fix: the duplicate is gone, and every list
   that never had one is untouched. The second half is the one worth having.
   Deduplicating runs over every option list on the form, so the risk is not that
   it fails to collapse the duplicate but that it quietly drops something else. */

const listen = optionslisten.listen as Record<string, Option[]>

describe('optionen', () => {
  it('bietet jede gespeicherte Antwort genau einmal an', () => {
    const werte = optionen('ausruestung.egeraet').map(({ wert }) => wert)

    expect(new Set(werte).size).toBe(werte.length)
  })

  it('behaelt den ersten Text, wenn zwei Eintraege dasselbe speichern', () => {
    const eintraege = optionen('ausruestung.egeraet')

    /* The PDF lists "keine Angabe" before "unbekannt" and both export
       "keine Angabe". Neither label is more correct than the other, so this
       asserts which one survives rather than that the right one did. */
    expect(eintraege.filter(({ wert }) => wert === 'keine Angabe')).toEqual([
      { wert: 'keine Angabe', label: 'keine Angabe' },
    ])
    expect(eintraege).toHaveLength(listen['ausruestung.egeraet'].length - 1)
  })

  /* Read off the seed file rather than written as numbers here, so refreshing
     the extraction cannot break a test that is not about the extraction. Only
     the E-Gerät list may come out shorter than it went in. */
  it('laesst jede Liste ohne Doppelte unveraendert', () => {
    for (const [name, eintraege] of Object.entries(listen)) {
      if (name === 'ausruestung.egeraet') continue
      expect(optionen(name as 'anlass')).toEqual(eintraege)
    }
  })

  it('gibt dieselbe Liste bei jedem Aufruf zurueck', () => {
    /* FeldSuche passes this straight to an MUI Autocomplete on every render, so
       a fresh array each call would be a prop that never compares equal. */
    expect(optionen('probestrecke.monitoringnummer')).toBe(
      optionen('probestrecke.monitoringnummer'),
    )
  })

  it('reicht im Code deklarierte Optionen unveraendert durch', () => {
    const skala = [
      { wert: '0', label: 'keine' },
      { wert: '1', label: 'wenig' },
    ] as const

    expect(optionen(skala)).toBe(skala)
  })

  it('gibt nichts zurueck, wenn die Seed-Datei die Liste nicht kennt', () => {
    // Not reachable through ListenName, which is the point: the type is the
    // first guard and this is what happens if something gets past it.
    expect(optionen('gibt.es.nicht' as 'anlass')).toEqual([])
  })
})

describe('optionLabel', () => {
  it('gibt das Label zum gespeicherten Code', () => {
    expect(optionLabel('gewaessertyp', '13')).toBe('Bach')
  })

  it('gibt den Code zurück, wenn die Liste ihn nicht kennt', () => {
    /* ADR 0004 never migrates a protocol to a later form version, so a protocol
       filed under an older one can carry a value this version's list no longer
       offers. An unfamiliar code still tells a reviewer more than a blank, and
       it is what FiaKa receives either way. */
    expect(optionLabel('gewaessertyp', '99')).toBe('99')
  })

  it('behandelt eine nicht beantwortete Auswahl als leer', () => {
    expect(optionLabel('gewaessertyp', undefined)).toBeNull()
    expect(optionLabel('gewaessertyp', '')).toBeNull()
    expect(optionLabel('gewaessertyp', '   ')).toBeNull()
  })

  it('liest auch eine im Code erklärte Liste', () => {
    // Part 4's 0 to 3 scale is declared beside its block rather than in the seed
    // file, because the legacy form stores those answers as free text.
    const stufen = [
      { wert: '0', label: 'nicht vorhanden' },
      { wert: '3', label: 'sehr viele' },
    ] as const
    expect(optionLabel(stufen, '3')).toBe('sehr viele')
  })
})

describe('optionLabelMitWert', () => {
  it('stellt den Code voran, wo er zum Vokabular gehört', () => {
    expect(optionLabelMitWert('gewaessertyp', '13')).toBe('13 - Bach')
  })

  it('druckt einen unbekannten Code einmal, nicht zweimal', () => {
    // "99 - 99" would read as a fault in the application rather than as a code
    // the current form version does not know.
    expect(optionLabelMitWert('gewaessertyp', '99')).toBe('99')
  })

  it('bleibt leer, wenn nichts gewählt wurde', () => {
    expect(optionLabelMitWert('gewaessertyp', '')).toBeNull()
  })
})
