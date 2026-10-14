import proj4 from 'proj4'
import { BW_GRENZEN, GANZE_ZAHL } from '../regeln/koordinaten'
import { istLeer } from '../regeln/regel'

/* Between the form's coordinates and the map's.

   The form stores EPSG:25832 (ETRS89 / UTM zone 32N) in whole metres, as the
   legacy PDF does. MapLibre works in longitude and latitude on WGS84. ETRS89 and
   WGS84 differ by well under a metre in Baden-Wuerttemberg, which is below what
   a whole-metre value can express, so the definition below treats them as the
   same datum, the way EPSG's own entry for 25832 does.

   This is the one place the two are converted. Snapping in feature 18d will
   keep a typed and a snapped position apart, and both go through here. */
const UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
const umrechner = proj4('EPSG:4326', UTM32)

export interface Kartenpunkt {
  lng: number
  lat: number
}

export interface Utm {
  rechtswert: string
  hochwert: string
}

/* Nothing for anything the coordinate rule would complain about: an empty
   box, a value that is not whole metres, or one outside the rectangle around
   Baden-Wuerttemberg. A marker on the map means "this is where your numbers
   put the stretch", so it only appears when the numbers are ones the form
   accepts; the rule's own message covers the rest. */
export function zuKartenpunkt(
  rechtswert: string | undefined,
  hochwert: string | undefined,
): Kartenpunkt | null {
  const rw = ganzeZahlInnerhalb(rechtswert, BW_GRENZEN.rechtswert)
  const hw = ganzeZahlInnerhalb(hochwert, BW_GRENZEN.hochwert)
  if (rw === null || hw === null) return null

  const [lng, lat] = umrechner.inverse([rw, hw])
  return { lng, lat }
}

/* Rounded to whole metres, because that is all regeln/koordinaten.ts accepts
   and all the legacy form ever held. Strings, because the answers document
   keeps every typed value as one. */
export function zuUtm(punkt: Kartenpunkt): Utm {
  const [rw, hw] = umrechner.forward([punkt.lng, punkt.lat])
  return { rechtswert: String(Math.round(rw)), hochwert: String(Math.round(hw)) }
}

function ganzeZahlInnerhalb(
  wert: string | undefined,
  grenzen: { min: number; max: number },
): number | null {
  if (istLeer(wert)) return null
  const eingabe = (wert ?? '').trim()
  if (!GANZE_ZAHL.test(eingabe)) return null
  const zahl = Number(eingabe)
  return zahl >= grenzen.min && zahl <= grenzen.max ? zahl : null
}
