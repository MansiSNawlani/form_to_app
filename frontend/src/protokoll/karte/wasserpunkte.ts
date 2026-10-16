import type { FeatureCollection, LineString } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import type { Grenze } from './Grenzwahl'
import type { Kartenpunkt } from './umrechnung'

/* The point on the water for each boundary, and a dashed line from where the
   surveyor put it. Display only: nothing here can be clicked or dragged, since
   the position on the water is worked out, never set. */

export type Wassermarken = Record<Grenze, maplibregl.Marker | null>

export interface Verbindung {
  gesetzt: Kartenpunkt | null
  amWasser: Kartenpunkt | null
}

const QUELLE = 'einrastlinien'

/* A ring rather than a label, so it is told from the typed marker by its shape
   and not only by its colour, and named for a screen reader like the other. */
export function setzeWassermarke(
  map: maplibregl.Map,
  marken: Wassermarken,
  grenze: Grenze,
  punkt: Kartenpunkt | null,
  name: string,
) {
  const vorhanden = marken[grenze]
  if (!punkt) {
    vorhanden?.remove()
    marken[grenze] = null
    return
  }
  if (vorhanden) {
    vorhanden.setLngLat(punkt)
    vorhanden.getElement().setAttribute('aria-label', name)
    vorhanden.getElement().title = name
    return
  }

  const element = document.createElement('div')
  element.className = `wassermarke wassermarke--${grenze}`
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', name)
  element.title = name
  marken[grenze] = new maplibregl.Marker({ element, anchor: 'center' })
    .setLngLat(punkt)
    .addTo(map)
}

export function zeichneVerbindungen(map: maplibregl.Map, verbindungen: Verbindung[]) {
  const daten: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: verbindungen.flatMap(({ gesetzt, amWasser }) =>
      gesetzt && amWasser
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [gesetzt.lng, gesetzt.lat],
                  [amWasser.lng, amWasser.lat],
                ],
              },
            },
          ]
        : [],
    ),
  }

  const quelle = map.getSource<maplibregl.GeoJSONSource>(QUELLE)
  if (quelle) {
    quelle.setData(daten)
  } else {
    map.addSource(QUELLE, { type: 'geojson', data: daten })
    map.addLayer({
      id: QUELLE,
      type: 'line',
      source: QUELLE,
      paint: { 'line-width': 2, 'line-dasharray': [2, 2] },
    })
  }
  // MapLibre paints on a canvas and cannot read a CSS variable, so the token is
  // read from the map's own element, and so in its theme, on every draw.
  map.setPaintProperty(QUELLE, 'line-color', token(map.getContainer(), '--text'))
}

function token(element: HTMLElement, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}
