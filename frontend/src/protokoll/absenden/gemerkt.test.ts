import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../entwurf/browserSpeicher'
import { KEY_PREFIX, createPruefungsStore } from './gemerkt'
import type { Verstoss } from '../../api/typen'

const JETZT = '2026-09-12T14:32:00.000Z'

function store(storage: Storage = memoryStorage()) {
  return { speicher: storage, store: createPruefungsStore({ storage, now: () => JETZT }) }
}

const VERSTOESSE: Verstoss[] = [
  { pfad: 'anlass', schluessel: 'protokoll.regeln.fehlt' },
  { pfad: 'summe.umland', schluessel: 'protokoll.regeln.fehltProzentgruppe' },
]

describe('createPruefungsStore', () => {
  it('gibt zurueck, was hineingeschrieben wurde', () => {
    const { store: s } = store()

    s.schreib('a1', VERSTOESSE)

    expect(s.lies('a1')).toEqual({
      id: 'a1',
      zeitpunkt: JETZT,
      verstoesse: VERSTOESSE,
      ausgeklappt: [],
    })
  })

  it('weiss von einem Protokoll nichts, bevor etwas abgelehnt wurde', () => {
    expect(store().store.lies('a1')).toBeNull()
  })

  /* One key per protocol. Showing protocol A's problems while somebody works on
     protocol B would send them to fix fields that are already filled in. */
  it('haelt zwei Protokolle auseinander', () => {
    const { store: s } = store()

    s.schreib('a1', VERSTOESSE)

    expect(s.lies('a2')).toBeNull()
  })

  it('vergisst ein Protokoll auf Wunsch', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.loesche('a1')

    expect(s.lies('a1')).toBeNull()
  })

  it('ueberschreibt eine aeltere Pruefung', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.schreib('a1', [{ pfad: 'datum', schluessel: 'protokoll.regeln.fehlt' }])

    expect(s.lies('a1')?.verstoesse).toHaveLength(1)
  })

  it('legt unter einem eigenen Namensraum ab, weil localStorage geteilt wird', () => {
    const { speicher, store: s } = store()

    s.schreib('a1', VERSTOESSE)

    expect(speicher.getItem(KEY_PREFIX + 'a1')).not.toBeNull()
  })

  /* Anything can end up under our key: a half-written value from a killed tab,
     or one written by an older shape of this code. */
  it('haelt Unsinn unter dem eigenen Schluessel aus', () => {
    const { speicher, store: s } = store()
    speicher.setItem(KEY_PREFIX + 'a1', '{kein json')

    expect(s.lies('a1')).toBeNull()
  })

  it('lehnt einen Eintrag ab, dem die Haelfte fehlt', () => {
    const { speicher, store: s } = store()
    speicher.setItem(KEY_PREFIX + 'a1', JSON.stringify({ id: 'a1', verstoesse: [] }))

    expect(s.lies('a1')).toBeNull()
  })

  /* One broken entry should not cost the other forty-six, which are still worth
     showing. */
  it('wirft nur den unbrauchbaren Eintrag weg, nicht die ganze Liste', () => {
    const { speicher, store: s } = store()
    speicher.setItem(
      KEY_PREFIX + 'a1',
      JSON.stringify({
        id: 'a1',
        zeitpunkt: JETZT,
        verstoesse: [{ pfad: 'anlass' }, null, VERSTOESSE[0]],
      }),
    )

    expect(s.lies('a1')?.verstoesse).toEqual([VERSTOESSE[0]])
  })

  it('gibt nichts zurueck, wenn kein Eintrag brauchbar ist', () => {
    const { speicher, store: s } = store()
    speicher.setItem(
      KEY_PREFIX + 'a1',
      JSON.stringify({ id: 'a1', zeitpunkt: JETZT, verstoesse: [{ pfad: 'anlass' }] }),
    )

    expect(s.lies('a1')).toBeNull()
  })

  /* A private window, a locked-down profile and a blocked-site-data setting all
     make the accessor itself throw. An unreadable list means the same as an
     absent one, and a browser that will not store it must not break the refusal
     the person still needs to read. */
  it('ueberlebt eine Storage, die bei jedem Zugriff wirft', () => {
    const kaputt = {
      getItem: () => {
        throw new Error('nein')
      },
      setItem: () => {
        throw new Error('nein')
      },
      removeItem: () => {
        throw new Error('nein')
      },
    } as unknown as Storage
    const s = createPruefungsStore({ storage: kaputt, now: () => JETZT })

    expect(() => s.schreib('a1', VERSTOESSE)).not.toThrow()
    expect(() => s.loesche('a1')).not.toThrow()
    expect(s.lies('a1')).toBeNull()
  })

  /* Nothing a surveyor typed is written to disk here, unlike the safety copy,
     which is what makes this store cheap and that one careful. */
  it('speichert keine Antworten, nur Pfade und Schluessel', () => {
    const { speicher, store: s } = store()

    s.schreib('a1', VERSTOESSE)

    const roh = speicher.getItem(KEY_PREFIX + 'a1') ?? ''
    const geparst = JSON.parse(roh) as { verstoesse: Record<string, unknown>[] }
    for (const eintrag of geparst.verstoesse) {
      expect(Object.keys(eintrag).sort()).toEqual(['pfad', 'schluessel'])
    }
  })

  it('merkt sich, welcher Abschnitt aufgeklappt wurde', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.klappe('a1', 2, true)

    expect(s.lies('a1')?.ausgeklappt).toEqual([2])
  })

  /* Each section keeps its own. Opening part 2 to read its three entries should
     not open part 6's twenty-six as well. */
  it('haelt die Abschnitte auseinander', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.klappe('a1', 2, true)
    s.klappe('a1', 5, true)

    expect(s.lies('a1')?.ausgeklappt).toEqual([2, 5])
  })

  it('klappt einen einzelnen Abschnitt wieder ein', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)
    s.klappe('a1', 2, true)
    s.klappe('a1', 5, true)

    s.klappe('a1', 2, false)

    expect(s.lies('a1')?.ausgeklappt).toEqual([5])
  })

  it('merkt sich einen Abschnitt nicht zweimal', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.klappe('a1', 2, true)
    s.klappe('a1', 2, true)

    expect(s.lies('a1')?.ausgeklappt).toEqual([2])
  })

  /* Folding is not a new check, so the list is still as old as it was and must
     not claim otherwise. */
  it('ruehrt den Zeitpunkt beim Klappen nicht an', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)

    s.klappe('a1', 2, true)

    expect(s.lies('a1')?.zeitpunkt).toBe(JETZT)
  })

  /* A fresh answer starts folded, like everything else. */
  it('klappt bei einer neuen Pruefung alles wieder ein', () => {
    const { store: s } = store()
    s.schreib('a1', VERSTOESSE)
    s.klappe('a1', 2, true)

    s.schreib('a1', VERSTOESSE)

    expect(s.lies('a1')?.ausgeklappt).toEqual([])
  })

  it('laesst sich fuer ein Protokoll ohne Pruefung folgenlos klappen', () => {
    const { store: s } = store()

    expect(() => s.klappe('a1', 2, true)).not.toThrow()
    expect(s.lies('a1')).toBeNull()
  })

  /* Written before folding existed, so the field is simply absent, and folded is
     the default anyway. */
  it('liest einen alten Eintrag als vollstaendig eingeklappt', () => {
    const { speicher, store: s } = store()
    speicher.setItem(
      KEY_PREFIX + 'a1',
      JSON.stringify({ id: 'a1', zeitpunkt: JETZT, verstoesse: VERSTOESSE }),
    )

    expect(s.lies('a1')?.ausgeklappt).toEqual([])
  })

  it('ignoriert Unsinn im Klapp-Merkmal', () => {
    const { speicher, store: s } = store()
    speicher.setItem(
      KEY_PREFIX + 'a1',
      JSON.stringify({
        id: 'a1',
        zeitpunkt: JETZT,
        verstoesse: VERSTOESSE,
        ausgeklappt: ['zwei', null, 3],
      }),
    )

    expect(s.lies('a1')?.ausgeklappt).toEqual([3])
  })
})
