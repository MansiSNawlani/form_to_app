import { describe, expect, it } from 'vitest'
import { MAX_BYTES, MAX_FOTOS, pruefeAnlage } from './regeln'
import type { Dateiangaben } from './typen'

function datei(teile: Partial<Dateiangaben> = {}): Dateiangaben {
  return { name: 'strecke.jpg', type: 'image/jpeg', size: 1024, ...teile }
}

describe('pruefeAnlage', () => {
  it('accepts an ordinary photograph', () => {
    expect(pruefeAnlage(datei(), 'FOTO', 0)).toBeNull()
  })

  it('accepts PNG and WEBP as well as JPEG', () => {
    expect(pruefeAnlage(datei({ type: 'image/png' }), 'FOTO', 0)).toBeNull()
    expect(pruefeAnlage(datei({ type: 'image/webp' }), 'FOTO', 0)).toBeNull()
  })

  /* Its own reason and not the general wrong-type one. Every iPhone produces
     these, and the only useful thing the message can say is how to get a JPG
     out of the phone, which is advice no other rejected type wants. */
  describe('an iPhone photograph', () => {
    it('is told apart by its media type', () => {
      const verstoss = pruefeAnlage(datei({ type: 'image/heic' }), 'FOTO', 0)

      expect(verstoss?.grund).toBe('heic')
    })

    it('is told apart by HEIF as well', () => {
      expect(pruefeAnlage(datei({ type: 'image/heif' }), 'FOTO', 0)?.grund).toBe('heic')
    })

    /* Browsers that have never heard of HEIC report an empty media type rather
       than an unknown one, so the extension is the only thing left to go on. */
    it('is told apart by its extension when the browser reports no type', () => {
      const verstoss = pruefeAnlage(
        datei({ name: 'IMG_4471.HEIC', type: '' }),
        'FOTO',
        0,
      )

      expect(verstoss?.grund).toBe('heic')
    })
  })

  it('refuses a file that is not a picture at all', () => {
    const verstoss = pruefeAnlage(
      datei({ name: 'notizen.txt', type: 'text/plain' }),
      'FOTO',
      0,
    )

    expect(verstoss?.grund).toBe('typ')
  })

  it('refuses a PDF, which is a document rather than a picture', () => {
    expect(
      pruefeAnlage(datei({ name: 'karte.pdf', type: 'application/pdf' }), 'KARTENAUSSCHNITT', 0)
        ?.grund,
    ).toBe('typ')
  })

  describe('the size cap', () => {
    it('accepts a file exactly on the limit', () => {
      expect(pruefeAnlage(datei({ size: MAX_BYTES }), 'FOTO', 0)).toBeNull()
    })

    /* The message names both numbers in MB, because "10485760 bytes" tells a
       surveyor nothing they can act on. Numbers rather than formatted strings:
       i18next renders them per locale, so no German reaches this module. */
    it('refuses a file over it and reports both sizes in MB', () => {
      const verstoss = pruefeAnlage(datei({ size: 12.5 * 1024 * 1024 }), 'FOTO', 0)

      expect(verstoss?.grund).toBe('groesse')
      expect(verstoss?.werte).toEqual({ dateiname: 'strecke.jpg', groesseMb: 12.5, maxMb: 10 })
    })

    it('rounds an awkward size to one decimal rather than printing every digit', () => {
      const verstoss = pruefeAnlage(datei({ size: 11_567_231 }), 'FOTO', 0)

      expect(verstoss?.werte).toEqual({ dateiname: 'strecke.jpg', groesseMb: 11, maxMb: 10 })
    })
  })

  describe('how many fit', () => {
    it('refuses a second map excerpt', () => {
      const verstoss = pruefeAnlage(datei({ name: 'karte.png' }), 'KARTENAUSSCHNITT', 1)

      expect(verstoss?.grund).toBe('anzahl')
    })

    it('accepts the twentieth photograph', () => {
      expect(pruefeAnlage(datei(), 'FOTO', MAX_FOTOS - 1)).toBeNull()
    })

    it('refuses the twenty-first and says how many are already there', () => {
      const verstoss = pruefeAnlage(datei(), 'FOTO', MAX_FOTOS)

      expect(verstoss?.grund).toBe('anzahl')
      expect(verstoss?.werte).toEqual({
        dateiname: 'strecke.jpg',
        vorhanden: MAX_FOTOS,
        max: MAX_FOTOS,
      })
    })
  })

  /* Order matters where two rules both apply. A HEIC file over the size cap is
     reported as HEIC, because converting it is what the surveyor has to do
     first and the resulting JPG is usually smaller anyway. */
  it('reports the type before the size when both are wrong', () => {
    const verstoss = pruefeAnlage(
      datei({ name: 'IMG_4471.HEIC', type: 'image/heic', size: 20 * 1024 * 1024 }),
      'FOTO',
      0,
    )

    expect(verstoss?.grund).toBe('heic')
  })

  /* And a full slot is reported before anything about the file, because no
     amount of fixing the file will make room for it. */
  it('reports a full slot before a problem with the file itself', () => {
    const verstoss = pruefeAnlage(
      datei({ name: 'notizen.txt', type: 'text/plain' }),
      'KARTENAUSSCHNITT',
      1,
    )

    expect(verstoss?.grund).toBe('anzahl')
  })
})
