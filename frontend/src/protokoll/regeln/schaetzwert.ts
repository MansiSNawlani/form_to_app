import { HYDROLOGIE_NICHT_ZUTREFFEND } from './hydrologie'
import { istLeer, type Regel, type Regelverstoss } from './regel'

/* The estimate under each of the two width and depth band pickers, which has to
   fall inside the band chosen above it.

   Defect 3 in docs/ffs-defect-list.md is why this is written out again rather
   than ported. The legacy check reads `value < lower AND value <= upper`, which
   no value above a band can ever satisfy, so selecting "0,1 - < 0,3 m" and
   entering 95 passes today.

   The bounds themselves are transcribed from the two field scripts in the
   legacy PDF, verified on 2026-09-02. Lower bound inclusive, upper bound
   exclusive, which is what the printed labels say: "< 2" is the band below 2,
   and 2 itself belongs to "< 5". The legacy code treats both ends as inclusive
   and so accepts 2 in two neighbouring bands. */

interface Band {
  von: number
  /** Absent on the last band, which is "100 or more" and has no top. */
  bis?: number
}

/** The two band pickers that carry an estimate underneath them. */
const BANDFELDER = ['breite', 'tiefe'] as const

type Bandfeld = (typeof BANDFELDER)[number]

/* Metres, keyed by the export value of the band. Only the seven real bands: the
   eighth button, exporting 0, means the section does not apply and is never
   offered as an option. */
export const BAENDER: Record<Bandfeld, Record<string, Band | undefined>> = {
  breite: {
    '1': { von: 0, bis: 1 },
    '2': { von: 1, bis: 2 },
    '3': { von: 2, bis: 5 },
    '4': { von: 5, bis: 15 },
    '5': { von: 15, bis: 50 },
    '6': { von: 50, bis: 100 },
    '7': { von: 100 },
  },
  tiefe: {
    '1': { von: 0, bis: 0.1 },
    '2': { von: 0.1, bis: 0.3 },
    '3': { von: 0.3, bis: 0.5 },
    '4': { von: 0.5, bis: 1 },
    '5': { von: 1, bis: 2 },
    '6': { von: 2, bis: 4 },
    '7': { von: 4 },
  },
}

/* A comma, because that is what the legacy form formats both estimates with and
   what a German keyboard produces. A full stop too, because an input of type
   number hands one over whatever was typed into it. Nothing else: an exponent,
   a thousands separator or a unit is not a number somebody meant. */
const DEZIMALZAHL = /^-?\d+([.,]\d+)?$/

function zahlAus(eingabe: string): number | undefined {
  if (!DEZIMALZAHL.test(eingabe)) return undefined
  return Number(eingabe.replace(',', '.'))
}

function passt(zahl: number, band: Band): boolean {
  if (zahl < band.von) return false
  return band.bis === undefined || zahl < band.bis
}

export const pruefeSchaetzwerte: Regel = (antworten) => {
  const hydrologie = antworten.hydrologie
  const verstoesse: Regelverstoss[] = []

  for (const feld of BANDFELDER) {
    const pfad = `hydrologie.${feld}_schaetzwert` as const
    const eingabe = (hydrologie?.[`${feld}_schaetzwert`] ?? '').trim()
    // Untouched is not wrong. An estimate only ever refines a band.
    if (istLeer(eingabe)) continue

    const gewaehlt = (hydrologie?.[feld] ?? '').trim()
    /* On a standing water the bands and the estimates are both marked as not
       applying by regeln/hydrologie.ts, so there is no band to fall inside. */
    if (gewaehlt === HYDROLOGIE_NICHT_ZUTREFFEND) continue

    if (istLeer(gewaehlt)) {
      verstoesse.push({
        pfad,
        schluessel: 'protokoll.regeln.schaetzwertOhneBand',
      })
      continue
    }

    const zahl = zahlAus(eingabe)
    if (zahl === undefined) {
      verstoesse.push({
        pfad,
        schluessel: 'protokoll.regeln.schaetzwertKeineZahl',
      })
      continue
    }

    /* A band the option list does not offer can only come from a hand-edited
       draft. There is nothing useful to say about it, and the test tying these
       tables to the option lists is what keeps it from being a real gap. */
    const band = BAENDER[feld][gewaehlt]
    if (band === undefined) continue

    if (!passt(zahl, band)) {
      verstoesse.push({
        pfad,
        schluessel: 'protokoll.regeln.schaetzwertAusserhalbBand',
      })
    }
  }

  return verstoesse
}
