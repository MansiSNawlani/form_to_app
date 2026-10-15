import { LANDESGRENZE, liegtImLand } from './landesgrenze'
import { istLeer, type Regel, type Regelverstoss } from './regel'
import type { Antworten } from '../entwurf/typen'

/* The four boundary coordinates, in EPSG:25832 (ETRS89 / UTM zone 32N) metres,
   which is what the legacy form and coding-standards.md both use.

   Two checks, one after the other. First a rectangle around the state, per
   box: Baden-Wuerttemberg spans roughly 7.5 to 10.5 degrees east and 47.5 to
   49.8 degrees north, which in zone 32N is about 388000 to 613000 east and
   5266000 to 5516000 north, rounded outward. It catches the mistakes that
   actually happen and can say which box holds one: a swapped Rechtswert and
   Hochwert, a dropped digit, a Gauss-Krueger value off an older map, or degrees
   typed instead of metres.

   Then, since feature 18b, the real border, per point. A point both of whose
   values pass the rectangle is tested against the state widened by 2 km
   (landesgrenze.ts), so Bavaria, Hesse, Alsace and Switzerland are caught too
   while the far bank of a border river is not. The message goes on both boxes
   of the point, because it is the pair that is wrong.

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
const AUSSERHALB_LANDES = 'protokoll.regeln.koordinateAusserhalbLandes'

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
export const GANZE_ZAHL = /^-?\d+$/

/* The two boundary points, each as its Rechtswert and Hochwert box. */
export const PUNKTE = [
  ['utm_rw_unten', 'utm_hw_unten'],
  ['utm_rw_oben', 'utm_hw_oben'],
] as const

export const pruefeKoordinaten: Regel = (antworten) => {
  const verstoesse: Regelverstoss[] = []
  const imRechteck = new Map<string, number>()

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
      continue
    }
    imRechteck.set(feld, zahl)
  }

  for (const [rechtswert, hochwert] of PUNKTE) {
    const rw = imRechteck.get(rechtswert)
    const hw = imRechteck.get(hochwert)
    // Only a point both of whose boxes passed. One already wrong has its own
    // message, and a point with one box empty is not a point yet.
    if (rw === undefined || hw === undefined) continue
    if (!liegtImLand(LANDESGRENZE, rw, hw)) {
      verstoesse.push({ pfad: `probestrecke.${rechtswert}`, schluessel: AUSSERHALB_LANDES })
      verstoesse.push({ pfad: `probestrecke.${hochwert}`, schluessel: AUSSERHALB_LANDES })
    }
  }

  return verstoesse
}
