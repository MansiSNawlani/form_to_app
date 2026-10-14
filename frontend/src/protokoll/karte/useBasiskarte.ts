import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { ladeStil, neueKarte } from './basiskarte'
import type { Kartenpunkt } from './umrechnung'

export type Kartenzustand = 'laedt' | 'bereit' | 'ohneWebgl' | 'ladefehler'

/* A MapLibre map in the given element, for as long as the component lives.

   texte and beiKlick must be stable across renders: a change to either builds
   the map again, which is what a change of language should do and nothing
   else should. */
export function useBasiskarte(
  behaelter: RefObject<HTMLDivElement | null>,
  texte: Record<string, string>,
  beiKlick: ((punkt: Kartenpunkt) => void) | null,
) {
  const karte = useRef<maplibregl.Map | null>(null)
  const [zustand, setZustand] = useState<Kartenzustand>('laedt')
  /* Counts loads, so whoever draws on the map draws again on a map rebuilt
     after the language changed, when zustand was already 'bereit' and so does
     not change. */
  const [geladen, setGeladen] = useState(0)

  useEffect(() => {
    const element = behaelter.current
    if (!element) return
    let aufgegeben = false

    ladeStil()
      .then((stil) => {
        if (aufgegeben) return
        let map: maplibregl.Map
        try {
          map = neueKarte(element, stil, texte)
        } catch {
          setZustand('ohneWebgl')
          return
        }
        karte.current = map
        map.on('load', () => {
          setZustand('bereit')
          setGeladen((anzahl) => anzahl + 1)
        })
        if (beiKlick) map.on('click', (ereignis) => beiKlick(ereignis.lngLat))
      })
      .catch(() => {
        if (!aufgegeben) setZustand('ladefehler')
      })

    return () => {
      aufgegeben = true
      karte.current?.remove()
      karte.current = null
    }
  }, [behaelter, texte, beiKlick])

  return { karte, zustand, geladen }
}
