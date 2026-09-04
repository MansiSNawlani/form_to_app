import { describe, expect, it } from 'vitest'
import { pruefeWiderspruch } from './einfluesse'
import { EINFLUSS_WIDERSPRUCH, NUTZUNGEN } from '../abschnitte/teil4/bloecke'
import type { Antworten } from '../entwurf/typen'

/* The Einflüsse block cannot say two things at once. "keine (erkennbar)" and
   "unbekannt" are blanket answers, each claiming the list below is empty, so
   neither may stand beside a named use or beside the other.

   The legacy form allows every combination below and checks none of them. This
   rule is ours, so nothing outside these tests holds it in place. */

const GESETZT = 'Ja'

function antworten(einfluesse: Antworten['einfluesse']): Antworten {
  return { einfluesse }
}

describe('die Einflüsse von Teil 4', () => {
  it('sagt nichts zu einem unberuehrten Block', () => {
    expect(pruefeWiderspruch({})).toEqual([])
    expect(pruefeWiderspruch(antworten({}))).toEqual([])
  })

  it('laesst jede Kombination genannter Nutzungen zu', () => {
    expect(
      pruefeWiderspruch(
        antworten({
          wasserkraft: GESETZT,
          schifffahrt: GESETZT,
          badebetrieb: GESETZT,
          sonstige_Nutzung: GESETZT,
        }),
      ),
    ).toEqual([])
  })

  it.each([
    ['keine (erkennbar)', 'keine_einfluesse', 'protokoll.regeln.einfluesseKeineUndNutzung'],
    ['unbekannt', 'unbekannt_einfluesse', 'protokoll.regeln.einfluesseUnbekanntUndNutzung'],
  ] as const)('beanstandet %s neben einer genannten Nutzung', (_name, feld, schluessel) => {
    expect(
      pruefeWiderspruch(antworten({ [feld]: GESETZT, wasserkraft: GESETZT })),
    ).toEqual([{ pfad: EINFLUSS_WIDERSPRUCH, schluessel }])
  })

  it.each(['keine_einfluesse', 'unbekannt_einfluesse'] as const)(
    'laesst %s allein stehen',
    (feld) => {
      expect(pruefeWiderspruch(antworten({ [feld]: GESETZT }))).toEqual([])
    },
  )

  it('beanstandet beide Blankettantworten zusammen', () => {
    expect(
      pruefeWiderspruch(
        antworten({ keine_einfluesse: GESETZT, unbekannt_einfluesse: GESETZT }),
      ),
    ).toEqual([
      { pfad: EINFLUSS_WIDERSPRUCH, schluessel: 'protokoll.regeln.einfluesseBeideBlankett' },
    ])
  })

  /* One message, not two. A block holding both mistakes at once is confused
     enough without being told two things to fix in one line. */
  it('meldet bei beiden Blankettantworten nur den einen Widerspruch', () => {
    const verstoesse = pruefeWiderspruch(
      antworten({
        keine_einfluesse: GESETZT,
        unbekannt_einfluesse: GESETZT,
        wasserkraft: GESETZT,
      }),
    )
    expect(verstoesse).toHaveLength(1)
    expect(verstoesse[0].schluessel).toBe('protokoll.regeln.einfluesseBeideBlankett')
  })

  /* Every one of the thirteen contradicts a blanket answer, not just the first.
     A named use that was left out of NUTZUNGEN would pass unnoticed otherwise. */
  it.each(NUTZUNGEN)('beanstandet %s neben "keine (erkennbar)"', (pfad) => {
    const feld = pfad.slice('einfluesse.'.length)
    expect(
      pruefeWiderspruch(antworten({ keine_einfluesse: GESETZT, [feld]: GESETZT })),
    ).toHaveLength(1)
  })

  it('umfasst dreizehn genannte Nutzungen', () => {
    expect(NUTZUNGEN).toHaveLength(13)
  })

  /* Untouched is not wrong, and neither is touched-and-cleared. A checkbox that
     was ticked and unticked holds the empty string, not undefined. */
  it('wertet ein geleertes Kreuz nicht als gesetzt', () => {
    expect(
      pruefeWiderspruch(antworten({ keine_einfluesse: GESETZT, wasserkraft: '' })),
    ).toEqual([])
  })

  /* The message belongs to the block, never to a tick. React Hook Form would
     hang it on a real field if the two ever named the same path. */
  it('haengt die Meldung an keinen Feldpfad', () => {
    const [verstoss] = pruefeWiderspruch(
      antworten({ keine_einfluesse: GESETZT, wasserkraft: GESETZT }),
    )
    expect(verstoss.pfad).toBe(EINFLUSS_WIDERSPRUCH)
    expect(verstoss.pfad.startsWith('einfluesse.')).toBe(false)
  })
})
