import { describe, expect, it } from 'vitest'
import felder from '@formular/felder.json'
import pflichtdatei from '@formular/pflichtfelder.json'
import { istPflichtfeld, pflichtfelderListe } from './pflicht'

/* The paths the legacy form actually has, so a required field that does not
   exist is caught here as well as on the server. A hand-authored list is exactly
   where a path gets mistyped, and a required field nobody can fill in would
   refuse every protocol ever submitted. */
const VORHANDEN = new Set(felder.felder.map((feld) => feld.name))

/* Added by this app on top of the printed form. app/formular/felder.py keeps the
   same allowance and says why: the PDF has a street and a postcode but no town. */
const ZUSAETZLICH = new Set(['bearbeiter.ort'])

describe('istPflichtfeld', () => {
  it('liest dieselbe Datei wie der Server', () => {
    // Not a copy of the list, the list itself. This is the whole point of the
    // file: before feature 11c the marker on screen and the gate at submit were
    // two separate truths and had already drifted.
    expect(pflichtfelderListe()).toEqual(pflichtdatei.pflichtfelder)
  })

  it('gehoert zu dieser Formularversion', () => {
    expect(pflichtdatei.version).toBe(felder.version)
  })

  it.each(pflichtfelderListe())('kennt %s als Pflichtfeld', (pfad) => {
    expect(istPflichtfeld(pfad)).toBe(true)
  })

  it.each(pflichtfelderListe())('verlangt mit %s ein Feld, das es wirklich gibt', (pfad) => {
    expect(VORHANDEN.has(pfad) || ZUSAETZLICH.has(pfad)).toBe(true)
  })

  it('nennt kein Feld zweimal', () => {
    const liste = pflichtfelderListe()
    expect(new Set(liste).size).toBe(liste.length)
  })

  it('haelt nichts fuer Pflicht, was nicht in der Liste steht', () => {
    // The remarks are the clearest case: never required, in any part.
    expect(istPflichtfeld('bemerkungen.sonstige_bemerkungen')).toBe(false)
    expect(istPflichtfeld('gibt.es.nicht')).toBe(false)
  })

  /* The conditional ones are deliberately absent. A flat list cannot say "only
     for a monitoring occasion", so those fields pass their own answer to
     FeldRahmen instead, and the rules enforce them on the server. */
  it('enthaelt die bedingten Felder nicht', () => {
    expect(istPflichtfeld('probestrecke.monitoringnummer')).toBe(false)
  })
})
