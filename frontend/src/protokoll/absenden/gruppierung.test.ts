import { describe, expect, it } from 'vitest'
import { UNBRAUCHBAR_SCHLUESSEL, gruppiere, offeneJeAbschnitt } from './gruppierung'

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


describe('gruppiere, erledigte Eintraege', () => {
  it('zaehlt ohne erledigte alles als offen', () => {
    const liste = gruppiere([fehlt('anlass'), fehlt('datum')])

    expect(liste.offen).toBe(2)
    expect(liste.gruppen[0].probleme.every((problem) => !problem.erledigt)).toBe(true)
  })

  it('hakt ab, was inzwischen ausgefuellt wurde', () => {
    const liste = gruppiere([fehlt('anlass'), fehlt('datum')], new Set(['anlass']))

    expect(liste.offen).toBe(1)
    expect(liste.gruppen[0].probleme.map((problem) => problem.erledigt)).toEqual([true, false])
  })

  /* Struck through, not removed. An entry vanishing under the cursor moves
     everything below it and loses the reader's place, and it would also claim
     more than the browser knows: only the server can say the value is right. */
  it('entfernt einen erledigten Eintrag nicht aus der Liste', () => {
    const liste = gruppiere([fehlt('anlass')], new Set(['anlass']))

    expect(liste.anzahl).toBe(1)
    expect(liste.gruppen[0].probleme).toHaveLength(1)
    expect(liste.offen).toBe(0)
  })

  it('kennt fuer eine leere Liste keine offenen', () => {
    expect(gruppiere([]).offen).toBe(0)
  })
})

describe('offeneJeAbschnitt', () => {
  it('zaehlt je Abschnitt', () => {
    const offen = offeneJeAbschnitt([
      fehlt('anlass'),
      fehlt('datum'),
      fehlt('messdaten.temperatur'),
    ])

    expect(offen.get(1)).toBe(2)
    expect(offen.get(2)).toBe(1)
  })

  /* Absent rather than zero, so the bar puts a marker only where there is
     something to mark. */
  it('nennt einen Abschnitt ohne Probleme gar nicht', () => {
    const offen = offeneJeAbschnitt([fehlt('anlass')])

    expect(offen.has(3)).toBe(false)
    expect([...offen.keys()]).toEqual([1])
  })

  it('zaehlt erledigte nicht mit', () => {
    const offen = offeneJeAbschnitt([fehlt('anlass'), fehlt('datum')], new Set(['anlass']))

    expect(offen.get(1)).toBe(1)
  })

  it('laesst einen Abschnitt fallen, sobald alles darin ausgefuellt ist', () => {
    const offen = offeneJeAbschnitt([fehlt('anlass')], new Set(['anlass']))

    expect(offen.has(1)).toBe(false)
  })

  /* A block-level problem has no single box to fill, so it holds its section's
     marker until the server says otherwise. */
  it('behaelt einen Sammelpfad, auch wenn Felder ausgefuellt wurden', () => {
    const offen = offeneJeAbschnitt(
      [{ pfad: 'summe.umland', schluessel: 'protokoll.regeln.fehltProzentgruppe' }],
      new Set(['umland.wiese']),
    )

    expect(offen.get(3)).toBe(1)
  })

  it('zaehlt ein Problem ohne bekannten Abschnitt nirgends mit', () => {
    const offen = offeneJeAbschnitt([fehlt('gibt.es.nicht')])

    expect(offen.size).toBe(0)
  })
})

/* Antworten, die ein Import nicht uebernehmen konnte.
 *
 * Etwas anderes als ein Verstoss, und deshalb eine eigene Liste je Abschnitt.
 * Ein Verstoss heisst: die Antwort fehlt oder ist falsch. Das hier heisst: die
 * Antwort steht im Protokoll, genau so wie die PDF sie geschrieben hat, und
 * diese Anwendung konnte sie nicht lesen. Wer ein Datum sucht, das vor ihm im
 * Feld steht, sucht den falschen Fehler.
 */
describe('unbrauchbare Antworten aus einem Import', () => {
  it('legt sie in den Abschnitt, in dem das Feld steht', () => {
    const liste = gruppiere([], new Set(), ['datum'])

    expect(liste.gruppen.map((gruppe) => gruppe.nr)).toEqual([1])
    expect(liste.gruppen[0].unbrauchbar.map((problem) => problem.pfad)).toEqual(['datum'])
  })

  it('haelt sie von den Verstoessen getrennt', () => {
    const liste = gruppiere([fehlt('anlass')], new Set(), ['datum'])

    const abschnitt1 = liste.gruppen[0]
    expect(abschnitt1.probleme.map((problem) => problem.pfad)).toEqual(['anlass'])
    expect(abschnitt1.unbrauchbar.map((problem) => problem.pfad)).toEqual(['datum'])
  })

  it('gibt ihnen den Schluessel, der fuer alle gilt', () => {
    const liste = gruppiere([], new Set(), ['datum'])

    expect(liste.gruppen[0].unbrauchbar[0].schluessel).toBe(UNBRAUCHBAR_SCHLUESSEL)
  })

  it('findet den Feldnamen genauso wie fuer einen Verstoss', () => {
    const liste = gruppiere([], new Set(), ['datum'])

    expect(liste.gruppen[0].unbrauchbar[0].labelKey).not.toBeNull()
  })

  it('zaehlt sie mit', () => {
    const liste = gruppiere([fehlt('anlass')], new Set(), ['datum', 'uhrzeit'])

    expect(liste.anzahl).toBe(3)
    expect(liste.offen).toBe(3)
  })

  /* Hakt sich nie ab, anders als ein Verstoss.
  
     Ein Verstoss hakt sich ab, sobald sein Feld nicht mehr leer ist. Hier sagt
     das nichts: das Backend legt den unlesbaren Wert genau so ab, wie die PDF
     ihn geschrieben hat, das Feld ist also schon bei der Ankunft gefuellt, und
     der Eintrag haette sich abgehakt, bevor jemand hingesehen hat. Er bleibt
     stehen, bis ein frisches Absenden sagt, was der Server von dem Wert haelt. */
  it('hakt sich nicht ab, nur weil im Feld etwas steht', () => {
    const liste = gruppiere([], new Set(['datum']), ['datum'])

    expect(liste.gruppen[0].unbrauchbar[0].erledigt).toBe(false)
    expect(liste.offen).toBe(1)
    expect(liste.anzahl).toBe(1)
  })

  /* Beides, nicht eines von beiden unterdrueckt: die zwei sagen Verschiedenes,
     und ein unlesbarer Wert, der ausserdem eine Regel bricht, muss aus beiden
     Gruenden neu getippt werden. */
  it('zeigt ein Feld, das beides ist, in beiden Listen', () => {
    const liste = gruppiere([fehlt('datum')], new Set(), ['datum'])

    expect(liste.gruppen[0].probleme).toHaveLength(1)
    expect(liste.gruppen[0].unbrauchbar).toHaveLength(1)
  })

  /* Ein Pfad, den verortung.ts nicht kennt, wird aufgelistet statt fallen
     gelassen: eine Antwort, die niemand sehen kann, ist schlimmer als eine,
     die niemand anklicken kann. */
  it('listet einen Pfad ohne Abschnitt statt ihn fallen zu lassen', () => {
    const liste = gruppiere([], new Set(), ['gibtesnicht.feld'])

    expect(liste.gruppen).toEqual([])
    expect(liste.unverortet.map((problem) => problem.pfad)).toEqual(['gibtesnicht.feld'])
  })

  it('macht ohne Verstoesse und ohne Unbrauchbares weiterhin nichts', () => {
    const liste = gruppiere([], new Set(), [])

    expect(liste.anzahl).toBe(0)
    expect(liste.gruppen).toEqual([])
  })

  it('gibt jeder Gruppe eine leere Liste, wenn nichts eingelesen wurde', () => {
    const liste = gruppiere([fehlt('anlass')])

    expect(liste.gruppen[0].unbrauchbar).toEqual([])
  })
})

/* Ohne das liest sich ein Abschnitt, dessen einzige offene Arbeit ein nicht
   lesbares Datum ist, als fertig, und der Wert bleibt liegen, bis ein Pruefer
   ihn findet. */
describe('offeneJeAbschnitt mit unbrauchbaren Antworten', () => {
  it('zaehlt sie neben den Verstoessen', () => {
    const offen = offeneJeAbschnitt([fehlt('anlass')], new Set(), ['datum'])

    expect(offen.get(1)).toBe(2)
  })

  it('markiert einen Abschnitt, in dem nur etwas Unlesbares steht', () => {
    const offen = offeneJeAbschnitt([], new Set(), ['datum'])

    expect(offen.get(1)).toBe(1)
  })

  /* Aus demselben Grund: das Feld ist schon gefuellt, und genau das ist die
     Arbeit, die niemand sieht. */
  it('behaelt die Markierung, auch wenn im Feld etwas steht', () => {
    const offen = offeneJeAbschnitt([], new Set(['datum']), ['datum'])

    expect(offen.get(1)).toBe(1)
  })
})
