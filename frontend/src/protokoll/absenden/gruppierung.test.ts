import { describe, expect, it } from 'vitest'
import { gruppiere } from './gruppierung'

const fehlt = (pfad: string) => ({ pfad, schluessel: 'protokoll.regeln.fehlt' })

describe('gruppiere', () => {
  it('macht aus nichts nichts', () => {
    const liste = gruppiere([])

    expect(liste.anzahl).toBe(0)
    expect(liste.gruppen).toEqual([])
    expect(liste.unverortet).toEqual([])
  })

  it('legt jedes Problem in seinen Abschnitt', () => {
    const liste = gruppiere([fehlt('anlass'), fehlt('messdaten.temperatur'), fehlt('datum')])

    expect(liste.gruppen.map((gruppe) => gruppe.nr)).toEqual([1, 2])
    expect(liste.gruppen[0].probleme.map((problem) => problem.pfad)).toEqual(['anlass', 'datum'])
    expect(liste.anzahl).toBe(3)
  })

  /* The server sends them in form order already, but a rule judging two parts at
     once, such as the hydrology one reading the water type out of part 1, would
     otherwise put part 2 ahead of part 1 in the list. */
  it('sortiert die Abschnitte, auch wenn sie durcheinander ankommen', () => {
    const liste = gruppiere([
      fehlt('ausruestung.egeraet'),
      fehlt('umland.auwald'),
      fehlt('anlass'),
    ])

    expect(liste.gruppen.map((gruppe) => gruppe.nr)).toEqual([1, 3, 5])
  })

  it('behaelt die Reihenfolge innerhalb eines Abschnitts', () => {
    const liste = gruppiere([
      fehlt('hydrologie.breite'),
      fehlt('messdaten.temperatur'),
      fehlt('hydrologie.tiefe'),
    ])

    expect(liste.gruppen[0].probleme.map((problem) => problem.pfad)).toEqual([
      'hydrologie.breite',
      'messdaten.temperatur',
      'hydrologie.tiefe',
    ])
  })

  /* A rule added to the backend and not to verortung.ts still reaches the
     person. A violation nobody can see would be worse than one nobody can
     click. */
  it('verliert ein Problem ohne bekannten Ort nicht', () => {
    const liste = gruppiere([fehlt('anlass'), fehlt('gibt.es.nicht')])

    expect(liste.unverortet.map((problem) => problem.pfad)).toEqual(['gibt.es.nicht'])
    expect(liste.anzahl).toBe(2)
  })

  it('merkt sich, in welcher Zeile der Artentabelle ein Problem steht', () => {
    const liste = gruppiere([
      { pfad: 'arten.art7.0plus', schluessel: 'protokoll.regeln.nullPlusUeberSumme' },
    ])

    expect(liste.gruppen[0].nr).toBe(6)
    expect(liste.gruppen[0].probleme[0].artnummer).toBe(7)
    // No label of its own: the panel names the row by the species standing in it.
    expect(liste.gruppen[0].probleme[0].labelKey).toBeNull()
  })

  it('gibt jedem Abschnitt seinen Titel mit', () => {
    const liste = gruppiere([fehlt('anlass')])

    expect(liste.gruppen[0].titelKey).toBe('protokoll.abschnitte.anlass')
  })

  /* An untouched protocol trips every required field at once, which is the
     longest this list ever gets and the case the panel's layout has to survive. */
  it('kommt mit einem ganz leeren Protokoll zurecht', () => {
    const alle = [
      'anlass',
      'z.rp',
      'datum',
      'messdaten.uhrzeit',
      'bearbeiter.name',
      'messdaten.temperatur',
      'hydrologie.breite',
      'ausruestung.egeraet',
    ].map(fehlt)

    const liste = gruppiere([
      ...alle,
      { pfad: 'tabelle.arten', schluessel: 'protokoll.regeln.fehltArt' },
    ])

    expect(liste.anzahl).toBe(9)
    expect(liste.unverortet).toEqual([])
    expect(liste.gruppen.map((gruppe) => gruppe.nr)).toEqual([1, 2, 5, 6])
  })
})
