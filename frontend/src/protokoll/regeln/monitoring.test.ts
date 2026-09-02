import { describe, expect, it } from 'vitest'
import { pruefeMonitoringnummer } from './monitoring'
import type { Antworten } from '../entwurf/typen'

/* The six Anlass values are the export values extracted from the legacy PDF.
   Only wrrl and ffh are monitoring programmes, and only a monitoring programme
   assigns a Monitoringstrecken-Nr. */
const OHNE_PFLICHT = ['best', 'bergung', 'maps', 'sonst']
const MIT_PFLICHT = ['wrrl', 'ffh']

function antworten(anlass?: string, monitoringnummer?: string): Antworten {
  return { anlass, probestrecke: { monitoringnummer } }
}

describe('pruefeMonitoringnummer', () => {
  it.each(OHNE_PFLICHT)('accepts a missing number for %s', (anlass) => {
    expect(pruefeMonitoringnummer(antworten(anlass))).toEqual([])
  })

  it.each(OHNE_PFLICHT)('accepts a given number for %s', (anlass) => {
    expect(pruefeMonitoringnummer(antworten(anlass, '1001000001'))).toEqual([])
  })

  it.each(MIT_PFLICHT)('demands a number for %s', (anlass) => {
    expect(pruefeMonitoringnummer(antworten(anlass))).toEqual([
      {
        pfad: 'probestrecke.monitoringnummer',
        schluessel: 'protokoll.regeln.monitoringnummerPflicht',
      },
    ])
  })

  it.each(MIT_PFLICHT)('is satisfied by a number for %s', (anlass) => {
    expect(pruefeMonitoringnummer(antworten(anlass, '1001000001'))).toEqual([])
  })

  it('treats a cleared number as missing', () => {
    expect(pruefeMonitoringnummer(antworten('wrrl', '   '))).toHaveLength(1)
  })

  it('says nothing while no Anlass has been chosen', () => {
    expect(pruefeMonitoringnummer({})).toEqual([])
  })
})
