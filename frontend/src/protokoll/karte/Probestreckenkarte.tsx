import Alert from '@mui/material/Alert'
import * as maplibregl from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNurLesen } from '../nurlesen/kontext'
import type { Antworten } from '../entwurf/typen'
import { BW } from './basiskarte'
import { GESETZT, GRENZEN } from './einrasten'
import Einrastanzeige from './Einrastanzeige'
import Grenzwahl, { type Grenze } from './Grenzwahl'
import { useBasiskarte } from './useBasiskarte'
import { useEinrasten } from './useEinrasten'
import { useKartenpunkte } from './useKartenpunkte'
import { useKartentexte } from './useKartentexte'
import { zuUtm, type Kartenpunkt } from './umrechnung'
import { setzeWassermarke, zeichneVerbindungen, type Wassermarken } from './wasserpunkte'
import './probestreckenkarte.css'

/* The two boundary points of the stretch, on the federal background map.

   The four coordinate boxes are the record. This reads them through useWatch
   and writes them through setValue, exactly as typing would, so the form stays
   the one owner of the values (coding-standards.md, Forms) and the automatic
   save and the coordinate rule see a map edit like any other. Loaded with
   React.lazy from ProbestreckeBlock, so MapLibre is fetched only when a
   protocol's first section is opened.

   Since feature 18d each point also has a position on the water, shown as a
   ring joined to its marker by a dashed line. Those come from the stored
   answers, which useEinrasten keeps current while editing, so the review
   screen shows exactly what was filed. */

type Marken = Record<Grenze, maplibregl.Marker | null>

interface Kartenmarken {
  karte: maplibregl.Map | null
  marken: Marken
  wasser: Wassermarken
}

// Markers belong to one map. A map rebuilt for a new language starts bare.
const leereMarken = (karte: maplibregl.Map | null): Kartenmarken => ({
  karte,
  marken: { unten: null, oben: null },
  wasser: { unten: null, oben: null },
})

function Probestreckenkarte() {
  const { t } = useTranslation()
  const nurLesen = useNurLesen()
  const { setValue } = useFormContext<Antworten>()
  const behaelter = useRef<HTMLDivElement>(null)
  const marken = useRef<Kartenmarken>(leereMarken(null))
  const unsicher = useEinrasten(!nurLesen)
  const punkte = useKartenpunkte(unsicher)
  const texte = useKartentexte()
  const [gewaehlt, setGewaehlt] = useState<Grenze>('unten')
  const gewaehltRef = useRef(gewaehlt)
  // Set by a map edit, so the map does not refit itself under the pointer.
  const ausKarte = useRef(false)

  useEffect(() => {
    gewaehltRef.current = gewaehlt
  }, [gewaehlt])

  const schreibe = useCallback(
    (grenze: Grenze, punkt: Kartenpunkt) => {
      const { rechtswert, hochwert } = zuUtm(punkt)
      const optionen = { shouldDirty: true, shouldTouch: true, shouldValidate: true }
      ausKarte.current = true
      setValue(GESETZT[grenze].rw, rechtswert, optionen)
      setValue(GESETZT[grenze].hw, hochwert, optionen)
    },
    [setValue],
  )
  const beiKlick = useMemo(
    () => (nurLesen ? null : (punkt: Kartenpunkt) => schreibe(gewaehltRef.current, punkt)),
    [nurLesen, schreibe],
  )

  const { karte, zustand, geladen } = useBasiskarte(behaelter, texte.steuerung, beiKlick)

  useEffect(() => {
    const map = karte.current
    if (zustand !== 'bereit' || !map) return
    if (marken.current.karte !== map) marken.current = leereMarken(map)

    const ziehen = nurLesen ? null : schreibe
    for (const grenze of GRENZEN) {
      const { gesetzt, amWasser } = punkte[grenze]
      setzeMarke(map, marken.current.marken, grenze, gesetzt, texte.marken[grenze], ziehen)
      const ring = gesetzt && amWasser
      setzeWassermarke(map, marken.current.wasser, grenze, ring, texte.amWasser[grenze])
    }
    zeichneVerbindungen(map, [punkte.unten, punkte.oben])
    if (ausKarte.current) {
      ausKarte.current = false
    } else {
      einpassen(map, punkte.unten.gesetzt, punkte.oben.gesetzt)
    }
  }, [karte, zustand, geladen, punkte, texte, nurLesen, schreibe])

  const fehler =
    zustand === 'ohneWebgl'
      ? t('protokoll.karte.fehlerWebgl')
      : zustand === 'ladefehler'
        ? t('protokoll.karte.fehlerLaden')
        : null

  return (
    <div className={`probestreckenkarte${nurLesen ? '' : ' probestreckenkarte--setzbar'}`}>
      <p className="form-section__hint">
        {t(nurLesen ? 'protokoll.karte.hinweisNurLesen' : 'protokoll.karte.hinweis')}
      </p>
      {!nurLesen && !fehler && <Grenzwahl gewaehlt={gewaehlt} waehlen={setGewaehlt} />}
      {fehler ? (
        <Alert severity="info">{fehler}</Alert>
      ) : (
        <div
          ref={behaelter}
          className="probestreckenkarte__flaeche"
          aria-busy={zustand === 'laedt'}
        />
      )}
      <Einrastanzeige unsicher={unsicher} />
    </div>
  )
}

/* Each marker carries a word, not only a colour, so which boundary is which
   does not depend on telling two colours apart. */
function setzeMarke(
  map: maplibregl.Map,
  marken: Marken,
  grenze: Grenze,
  punkt: Kartenpunkt | null,
  text: { kurz: string; lang: string },
  ziehen: ((grenze: Grenze, punkt: Kartenpunkt) => void) | null,
) {
  const vorhanden = marken[grenze]
  if (!punkt) {
    vorhanden?.remove()
    marken[grenze] = null
    return
  }
  if (vorhanden) {
    vorhanden.setLngLat(punkt)
    return
  }

  const element = document.createElement('div')
  element.className = `kartenmarke kartenmarke--${grenze}`
  element.textContent = text.kurz
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', text.lang)
  element.title = text.lang
  const marke = new maplibregl.Marker({ element, anchor: 'bottom', draggable: ziehen !== null })
    .setLngLat(punkt)
    .addTo(map)
  if (ziehen) marke.on('dragend', () => ziehen(grenze, marke.getLngLat()))
  marken[grenze] = marke
}

function einpassen(map: maplibregl.Map, unten: Kartenpunkt | null, oben: Kartenpunkt | null) {
  if (unten && oben) {
    /* Grown from both points rather than given as a pair, which MapLibre reads
       as south-west then north-east: a lower boundary east of the upper one
       would otherwise be a box round the far side of the globe. */
    const rahmen = new maplibregl.LngLatBounds(unten, unten).extend(oben)
    map.fitBounds(rahmen, { padding: 80, maxZoom: 15 })
  } else if (unten || oben) {
    map.easeTo({ center: (unten ?? oben)!, zoom: 14 })
  } else {
    map.fitBounds(BW)
  }
}

export default Probestreckenkarte
