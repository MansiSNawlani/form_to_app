import { describe, expect, it } from 'vitest'
import { letzteAenderungsbitte } from './aenderungsbitte'
import type { VerlaufEintrag } from './typen'

function eintrag(teile: Partial<VerlaufEintrag>): VerlaufEintrag {
  return {
    id: 'e1',
    von_status: 'SUBMITTED',
    nach_status: 'NEEDS_CHANGES',
    kommentar: 'Bitte die Leitfähigkeit nachtragen.',
    akteur_name: 'lehmann@ffs.de',
    created_at: '2026-07-12T16:20:00Z',
    ...teile,
  }
}

describe('letzteAenderungsbitte', () => {
  it('finds nothing in an empty history', () => {
    expect(letzteAenderungsbitte([])).toBeUndefined()
  })

  it('finds nothing when the protocol has only ever been submitted', () => {
    const verlauf = [eintrag({ von_status: 'DRAFT', nach_status: 'SUBMITTED', kommentar: null })]

    expect(letzteAenderungsbitte(verlauf)).toBeUndefined()
  })

  it('finds the change request among other moves', () => {
    const verlauf = [
      eintrag({ id: 'e3', von_status: 'SUBMITTED', nach_status: 'IN_REVIEW', kommentar: null }),
      eintrag({ id: 'e2', kommentar: 'Die Vorfluterkette endet nicht beim Rhein.' }),
      eintrag({ id: 'e1', von_status: 'DRAFT', nach_status: 'SUBMITTED', kommentar: null }),
    ]

    expect(letzteAenderungsbitte(verlauf)?.id).toBe('e2')
  })

  /* A protocol sent back twice carries two, and the older one has already been
     dealt with. The server sends newest first, so the first match is the one. */
  it('takes the most recent of two change requests', () => {
    const verlauf = [
      eintrag({ id: 'neu', kommentar: 'Jetzt fehlt noch die Sichttiefe.' }),
      eintrag({ id: 'alt', nach_status: 'SUBMITTED', kommentar: null }),
      eintrag({ id: 'aelter', kommentar: 'Bitte die Leitfähigkeit nachtragen.' }),
    ]

    expect(letzteAenderungsbitte(verlauf)?.kommentar).toBe('Jetzt fehlt noch die Sichttiefe.')
  })
})
