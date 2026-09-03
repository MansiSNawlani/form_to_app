import { describe, expect, it } from 'vitest'
import {
  HYDROLOGIE_NICHT_ZUTREFFEND,
  hydrologieAngleichen,
  istStehendesGewaesser,
} from './hydrologie'
import type { Antworten } from '../entwurf/typen'

/* The eight export values of probestrecke.gewaessertyp, split the way the
   legacy form's own button handlers split them. Verified against the PDF on
   2026-09-02. */
const FLIESSEND = ['11', '12', '13', '14', '28']
const STEHEND = ['21', '26', '29']

const NICHT = HYDROLOGIE_NICHT_ZUTREFFEND

type Hydrologie = NonNullable<Antworten['hydrologie']>

function antworten(
  gewaessertyp?: string,
  hydrologie?: Hydrologie,
): Antworten {
  return { probestrecke: { gewaessertyp }, hydrologie }
}

function pfade(gegeben: Antworten) {
  return hydrologieAngleichen(gegeben).map((angleichung) => angleichung.pfad)
}

/** The answers a filled-in Hydrologie block holds, one of each kind. */
const AUSGEFUELLT: Hydrologie = {
  breite: '3',
  breite_schaetzwert: '4,5',
  tiefe: '2',
  tiefe_schaetzwert: '0,2',
  tiefenvarianz: '3',
  mit_flachstellen: 'Ja',
  mit_gumpen: 'Ja',
  linienfuehrung: '2',
  furkationen: 'Ja',
  stroemung: '3',
  rueckstroemung: 'Ja',
  fliessgeschwindigkeit: '2',
  wasserfuehrung: '2',
  stillwasserbereich: '1',
  gesamtprofil: '4',
}

/** The same block once it has been marked as not applying. */
const NICHT_ZUTREFFEND: Hydrologie = {
  breite: NICHT,
  breite_schaetzwert: NICHT,
  tiefe: NICHT,
  tiefe_schaetzwert: NICHT,
  tiefenvarianz: NICHT,
  mit_flachstellen: '',
  mit_gumpen: '',
  linienfuehrung: NICHT,
  furkationen: '',
  stroemung: NICHT,
  rueckstroemung: '',
  fliessgeschwindigkeit: NICHT,
  wasserfuehrung: NICHT,
  stillwasserbereich: NICHT,
  gesamtprofil: NICHT,
}

describe('istStehendesGewaesser', () => {
  it.each(FLIESSEND)('says no to %s', (typ) => {
    expect(istStehendesGewaesser(typ)).toBe(false)
  })

  it.each(STEHEND)('says yes to %s', (typ) => {
    expect(istStehendesGewaesser(typ)).toBe(true)
  })

  /* Nothing chosen yet is not a standing water. The block stays on screen: most
     waters are flowing, and a section that is missing is worse than one that
     turns out not to apply. */
  it('says no while nothing has been chosen', () => {
    expect(istStehendesGewaesser(undefined)).toBe(false)
    expect(istStehendesGewaesser('')).toBe(false)
  })
})

describe('hydrologieAngleichen', () => {
  it('leaves the document alone while no Gewaessertyp has been chosen', () => {
    expect(hydrologieAngleichen({})).toEqual([])
    expect(hydrologieAngleichen(antworten(undefined, AUSGEFUELLT))).toEqual([])
  })

  describe('a standing water', () => {
    it.each(STEHEND)('marks the nine bands and both estimates for %s', (typ) => {
      const angleichungen = hydrologieAngleichen(antworten(typ, AUSGEFUELLT))
      const gesetzt = angleichungen.filter(({ wert }) => wert === NICHT)

      expect(gesetzt.map(({ pfad }) => pfad)).toEqual([
        'hydrologie.breite',
        'hydrologie.breite_schaetzwert',
        'hydrologie.tiefe',
        'hydrologie.tiefe_schaetzwert',
        'hydrologie.tiefenvarianz',
        'hydrologie.linienfuehrung',
        'hydrologie.stroemung',
        'hydrologie.fliessgeschwindigkeit',
        'hydrologie.wasserfuehrung',
        'hydrologie.stillwasserbereich',
        'hydrologie.gesamtprofil',
      ])
    })

    /* The legacy handlers set the bands and the estimates and never touch the
       four checkboxes, so a protocol switched from Bach to See keeps
       "mit Gumpen: Ja" on a pond. Clearing them is ours. */
    it('clears the four checkboxes the legacy form forgets', () => {
      const angleichungen = hydrologieAngleichen(antworten('21', AUSGEFUELLT))
      const geleert = angleichungen.filter(({ wert }) => wert === '')

      expect(geleert).toEqual([
        { pfad: 'hydrologie.mit_flachstellen', wert: '' },
        { pfad: 'hydrologie.mit_gumpen', wert: '' },
        { pfad: 'hydrologie.furkationen', wert: '' },
        { pfad: 'hydrologie.rueckstroemung', wert: '' },
      ])
    })

    it('marks an untouched block, so the document says so explicitly', () => {
      expect(hydrologieAngleichen(antworten('26'))).toHaveLength(11)
    })

    /* The effect that applies these writes reads the document it just wrote, so
       a block already marked has to produce nothing at all or it loops. */
    it.each(STEHEND)('has nothing left to do for %s once marked', (typ) => {
      expect(hydrologieAngleichen(antworten(typ, NICHT_ZUTREFFEND))).toEqual([])
    })
  })

  describe('a flowing water', () => {
    it.each(FLIESSEND)('leaves a filled-in block alone for %s', (typ) => {
      expect(hydrologieAngleichen(antworten(typ, AUSGEFUELLT))).toEqual([])
    })

    it.each(FLIESSEND)('leaves an untouched block alone for %s', (typ) => {
      expect(hydrologieAngleichen(antworten(typ))).toEqual([])
    })

    /* Switching See back to Bach. Nothing offers 0 as an option, so a group
       left holding it would render as unanswered while the document said the
       section does not apply, on a water where it does. */
    it.each(FLIESSEND)('clears a not-applicable marking for %s', (typ) => {
      const angleichungen = hydrologieAngleichen(
        antworten(typ, NICHT_ZUTREFFEND),
      )

      expect(angleichungen).toHaveLength(11)
      expect(angleichungen.every(({ wert }) => wert === '')).toBe(true)
    })

    it('clears only the marked answers, not the real ones beside them', () => {
      const gemischt = { ...AUSGEFUELLT, tiefe: NICHT, gesamtprofil: NICHT }

      expect(hydrologieAngleichen(antworten('13', gemischt))).toEqual([
        { pfad: 'hydrologie.tiefe', wert: '' },
        { pfad: 'hydrologie.gesamtprofil', wert: '' },
      ])
    })

    it('leaves the checkboxes alone', () => {
      const nurHaken = { ...NICHT_ZUTREFFEND, mit_gumpen: 'Ja' }

      expect(pfade(antworten('14', nurHaken))).not.toContain(
        'hydrologie.mit_gumpen',
      )
    })
  })
})
