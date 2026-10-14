import * as maplibregl from 'maplibre-gl'
import type { LngLatBoundsLike, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

/* The background map: where it comes from, what it must credit, and how a
   MapLibre map is set up on it. Nothing here knows about the protocol. */

/* basemap.de Web Vektor, colour, from the federal mapping agency (BKG). Free,
   no key, CC BY 4.0. */
const STIL_URL = 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json'

/* The licence's own wording and links, which the style's built-in attribution
   lacks. The year is that of the last download, and tiles are fetched live. */
const QUELLENVERMERK =
  '© GeoBasis-DE / <a href="https://www.bkg.bund.de" target="_blank" rel="noopener">BKG</a> ' +
  `(${new Date().getFullYear()}) ` +
  '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>'

// Baden-Wuerttemberg, and a margin around it the map may not be panned out of.
export const BW: LngLatBoundsLike = [
  [7.5, 47.5],
  [10.5, 49.8],
]
const SPIELRAUM: LngLatBoundsLike = [
  [5.5, 46.8],
  [12.5, 50.6],
]

/* MapLibre 6 finds its worker beside its own module, and neither Vite's
   pre-bundling in development nor the production build puts it there. Handing
   it over as an emitted asset works in both. */
maplibregl.setWorkerUrl(workerUrl)

/* Fetched here rather than handed to MapLibre as a URL, for two reasons. A
   failed fetch is one clear moment to say the map is unavailable, where
   MapLibre would only log it. And the style's own attribution is dropped, so
   the licence's wording is not shown twice in two versions. */
export async function ladeStil(): Promise<StyleSpecification> {
  const antwort = await fetch(STIL_URL)
  if (!antwort.ok) throw new Error(`basemap.de ${antwort.status}`)
  const stil = (await antwort.json()) as StyleSpecification
  for (const quelle of Object.values(stil.sources)) {
    if ('attribution' in quelle) delete quelle.attribution
  }
  return stil
}

/** Throws when the browser has no WebGL at all. */
export function neueKarte(
  element: HTMLElement,
  stil: StyleSpecification,
  texte: Record<string, string>,
): maplibregl.Map {
  const map = new maplibregl.Map({
    container: element,
    style: stil,
    bounds: BW,
    maxBounds: SPIELRAUM,
    attributionControl: { compact: false, customAttribution: QUELLENVERMERK },
    /* Two fingers or Ctrl to zoom. The map sits in the middle of a long form,
       and a wheel that zooms the map instead of scrolling the page traps
       anybody moving past it. */
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    locale: texte,
  })
  map.touchZoomRotate.disableRotation()
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  return map
}
