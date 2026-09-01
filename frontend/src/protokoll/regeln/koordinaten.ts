import { istLeer, type Regel, type Regelverstoss } from './regel'
import type { Antworten } from '../entwurf/typen'

/* The four boundary coordinates, in EPSG:25832 (ETRS89 / UTM zone 32N) metres,
   which is what the legacy form and coding-standards.md both use.

   The bounds are a rectangle around Baden-Wuerttemberg, not its border: the
   state spans roughly 7.5 to 10.5 degrees east and 47.5 to 49.8 degrees north,
   which in zone 32N is about 388000 to 613000 east and 5266000 to 5516000
   north, rounded outward. A point just over the line in Bavaria, Hesse,
   Switzerland or Alsace therefore passes.

   That is deliberate. The check is here to catch the mistakes that actually
   happen, all of which land far outside the box: a swapped Rechtswert and
   Hochwert, a dropped digit, a Gauss-Krueger value off an older map, or degrees
   typed instead of metres. Testing against the real border needs the official
   water body dataset and belongs to feature 18.

   Still to be confirmed with FFS, so they live here alone: the two messages
   that name a range interpolate these numbers through i18n/index.ts rather
   than repeating them, and changing a bound is one edit in one file. */
export const BW_GRENZEN = {
  rechtswert: { min: 380000, max: 620000 },
  hochwert: { min: 5255000, max: 5525000 },
} as const

type Koordinatenart = keyof typeof BW_GRENZEN
type Probestrecke = NonNullable<Antworten['probestrecke']>

interface Koordinatenfeld {
  feld: Extract<keyof Probestrecke, `utm_${string}`>
  art: Koordinatenart
  ausserhalb: Regelverstoss['schluessel']
}

const RECHTSWERT_AUSSERHALB = 'protokoll.regeln.koordinateRechtswertAusserhalb'
const HOCHWERT_AUSSERHALB = 'protokoll.regeln.koordinateHochwertAusserhalb'

const FELDER: Koordinatenfeld[] = [
  { feld: 'utm_rw_unten', art: 'rechtswert', ausserhalb: RECHTSWERT_AUSSERHALB },
  { feld: 'utm_hw_unten', art: 'hochwert', ausserhalb: HOCHWERT_AUSSERHALB },
  { feld: 'utm_rw_oben', art: 'rechtswert', ausserhalb: RECHTSWERT_AUSSERHALB },
  { feld: 'utm_hw_oben', art: 'hochwert', ausserhalb: HOCHWERT_AUSSERHALB },
]

/* Metres, so no decimal point and no thousands separator. The control is an
   input of type number, which still lets "512000.5" and "5,12e5" reach the
   document. A minus sign passes this test and fails the bounds test instead,
   which is the more useful complaint: a negative metre value is not a number
   somebody typed wrongly, it is a coordinate in the wrong place. */
const GANZE_ZAHL = /^-?\d+$/

export const pruefeKoordinaten: Regel = (antworten) => {
  const verstoesse: Regelverstoss[] = []

  for (const { feld, art, ausserhalb } of FELDER) {
    const wert = antworten.probestrecke?.[feld]
    // Untouched is not wrong. Whether a coordinate is required at all is
    // feature 11's gate.
    if (istLeer(wert)) continue

    const pfad = `probestrecke.${feld}` as const
    const eingabe = (wert ?? '').trim()

    if (!GANZE_ZAHL.test(eingabe)) {
      verstoesse.push({
        pfad,
        schluessel: 'protokoll.regeln.koordinateKeineGanzeZahl',
      })
      continue
    }

    const grenzen = BW_GRENZEN[art]
    const zahl = Number(eingabe)
    if (zahl < grenzen.min || zahl > grenzen.max) {
      verstoesse.push({ pfad, schluessel: ausserhalb })
    }
  }

  return verstoesse
}
