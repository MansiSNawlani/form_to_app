import { describe, expect, it } from 'vitest'
import { pruefeVorfluterkette } from './vorfluter'
import type { Antworten } from '../entwurf/typen'

/** The chain as five boxes, so a test reads like the form does. */
function kette(...namen: (string | undefined)[]): Antworten {
  const [vorfluter1, vorfluter2, vorfluter3, vorfluter4, vorfluter5] = namen
  return {
    probestrecke: {
      gewaesser: { vorfluter1, vorfluter2, vorfluter3, vorfluter4, vorfluter5 },
    },
  }
}

function pfade(antworten: Antworten) {
  return pruefeVorfluterkette(antworten).map((verstoss) => verstoss.pfad)
}

function schluessel(antworten: Antworten) {
  return pruefeVorfluterkette(antworten).map((verstoss) => verstoss.schluessel)
}

describe('pruefeVorfluterkette', () => {
  it('says nothing about an untouched chain', () => {
    expect(pruefeVorfluterkette(kette())).toEqual([])
    expect(pruefeVorfluterkette({})).toEqual([])
    expect(pruefeVorfluterkette(kette('', '  ', ''))).toEqual([])
  })

  it('accepts a chain that reaches the Donau', () => {
    expect(pruefeVorfluterkette(kette('Argen', 'Donau'))).toEqual([])
  })

  it('accepts a chain that is nothing but the Rhein', () => {
    expect(pruefeVorfluterkette(kette('Rhein'))).toEqual([])
  })

  it('accepts all five boxes filled when the last one ends the chain', () => {
    const voll = kette('Tobelbach', 'Untere Argen', 'Argen', 'Schussen', 'Rhein')
    expect(pruefeVorfluterkette(voll)).toEqual([])
  })

  /* Defect 2 in docs/ffs-defect-list.md: the legacy form lowercases every water
     body name, so multi-word names never matched anything reliably. We compare
     loosely and store exactly what was typed. */
  it('ignores case and surrounding spaces', () => {
    expect(pruefeVorfluterkette(kette('Argen', '  DONAU  '))).toEqual([])
    expect(pruefeVorfluterkette(kette('argen', 'rhein'))).toEqual([])
  })

  /* The last part of a German compound is what the thing is: an Oberrhein is a
     Rhein, a Donaubach is a Bach. */
  it('accepts a name ending in the Rhein or the Donau', () => {
    expect(pruefeVorfluterkette(kette('Alte Donau'))).toEqual([])
    expect(pruefeVorfluterkette(kette('Brettach', 'Oberrhein'))).toEqual([])
    expect(pruefeVorfluterkette(kette('Hochrhein'))).toEqual([])
  })

  it.each(['Donaubach', 'Donaut', 'Rheinbach', 'Rheinau', 'Donaukanal'])(
    'does not let %s end a chain',
    (name) => {
      expect(schluessel(kette('Argen', name))).toEqual([
        'protokoll.regeln.vorfluterKeinEndpunkt',
      ])
    },
  )

  it('demands an end at the Rhein or the Donau, on the last filled box', () => {
    expect(pfade(kette('Argen', 'Schussen'))).toEqual([
      'probestrecke.gewaesser.vorfluter2',
    ])
    expect(schluessel(kette('Argen', 'Schussen'))).toEqual([
      'protokoll.regeln.vorfluterKeinEndpunkt',
    ])
  })

  it('demands an end even when all five boxes are used', () => {
    const ohneEnde = kette('a', 'b', 'c', 'd', 'e')
    expect(pfade(ohneEnde)).toEqual(['probestrecke.gewaesser.vorfluter5'])
  })

  it('flags a gap in the chain', () => {
    expect(pfade(kette('Argen', '', 'Rhein'))).toEqual([
      'probestrecke.gewaesser.vorfluter2',
    ])
    expect(schluessel(kette('Argen', '', 'Rhein'))).toEqual([
      'protokoll.regeln.vorfluterLuecke',
    ])
  })

  it('flags every gap before the end of the chain', () => {
    expect(pfade(kette('Argen', '', '', 'Rhein'))).toEqual([
      'probestrecke.gewaesser.vorfluter2',
      'probestrecke.gewaesser.vorfluter3',
    ])
  })

  it('flags a gap in a chain that has no end yet', () => {
    expect(pfade(kette('Argen', '', 'Schussen'))).toEqual([
      'probestrecke.gewaesser.vorfluter2',
      'probestrecke.gewaesser.vorfluter3',
    ])
    expect(schluessel(kette('Argen', '', 'Schussen'))).toEqual([
      'protokoll.regeln.vorfluterLuecke',
      'protokoll.regeln.vorfluterKeinEndpunkt',
    ])
  })

  it('flags anything filled in after the end of the chain', () => {
    const zuWeit = kette('Argen', 'Schussen', 'Rhein', 'Bodensee')
    expect(pfade(zuWeit)).toEqual(['probestrecke.gewaesser.vorfluter4'])
    expect(schluessel(zuWeit)).toEqual([
      'protokoll.regeln.vorfluterNachEndpunkt',
    ])
  })

  it('flags the first filled box after the end, not an empty one', () => {
    const zuWeit = kette('Rhein', '', 'Bodensee')
    expect(pfade(zuWeit)).toEqual(['probestrecke.gewaesser.vorfluter3'])
  })

  it('flags only the first box after the end, however many follow', () => {
    const zuWeit = kette('Rhein', 'Bodensee', 'Aare', 'Reuss')
    expect(pfade(zuWeit)).toEqual(['probestrecke.gewaesser.vorfluter2'])
  })
})
