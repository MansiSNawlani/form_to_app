import optionslisten from '@formular/optionslisten.json'
import { describe, expect, it } from 'vitest'
import { optionen, type Option } from './optionen'

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
