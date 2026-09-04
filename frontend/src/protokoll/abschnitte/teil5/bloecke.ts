import type { ParseKeys } from 'i18next'
import type { AntwortPfad } from '../../entwurf/typen'

/* The runs of part 5, declared once and rendered by mapping.
 *
 * The same shape and the same reasoning as teil3/gruppen.ts and teil4/bloecke.ts,
 * which this file should be read alongside. A declared array is the only thing
 * bloecke.test.ts can check against felder.json, which is what proves these paths
 * match the legacy form; Antworten is a TypeScript interface and is gone at build
 * time. Typed as AntwortPfad, so a path that is not in the answers document is a
 * build error, and the test covers the other direction.
 *
 * Part 5 declares less than part 4 did. The equipment block is ten fields that
 * differ from one another in type, unit and control, so a shared definition would
 * buy nothing there and they are written out in AusruestungBlock.tsx. What is
 * declared here is what actually repeats: the two nets, and the two fished area
 * rows, which are the same seven controls twice.
 */

export interface Blockfeld {
  pfad: AntwortPfad
  labelKey: ParseKeys
}

/* The two nets that may accompany the fishing, printed under "begleitend:" and
   ticked rather than counted. */
export const NETZE: readonly Blockfeld[] = [
  {
    pfad: 'ausruestung.kiemennetz',
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.kiemennetz',
  },
  {
    pfad: 'ausruestung.stoppnetz',
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.stoppnetz',
  },
]

/* One of the two areas the printed form asks about: the whole width of the
 * water, and along the banks. Each is a length, an effective width, two
 * directions and three methods.
 *
 * The two rows are the same seven questions with different field prefixes,
 * ges_gew_ and ufer_, which is exactly what a declaration is for. The label keys
 * differ per row rather than being shared across both, because a screen reader
 * user meets "watend" twice on this page and the column heading that separates
 * them visually is not attached to either control.
 */
export interface BefischterBereich {
  /** Names the row, used as the group's legend. */
  legendKey: ParseKeys
  laenge: AntwortPfad
  breite: AntwortPfad
  /** The two Richtung ticks and the three Methode ticks, in printed order. */
  richtung: readonly Blockfeld[]
  methode: readonly Blockfeld[]
}

export const BEFISCHTE_BEREICHE: readonly BefischterBereich[] = [
  {
    legendKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.legend',
    laenge: 'befischte_bereiche.ges_gew_laenge',
    breite: 'befischte_bereiche.ges_gew_breite',
    richtung: [
      {
        pfad: 'befischte_bereiche.ges_gew_stromauf',
        labelKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.stromauf',
      },
      {
        pfad: 'befischte_bereiche.ges_gew_stromab',
        labelKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.stromab',
      },
    ],
    methode: [
      {
        pfad: 'befischte_bereiche.ges_gew_vom_boot',
        labelKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.vomBoot',
      },
      {
        pfad: 'befischte_bereiche.ges_gew_watend',
        labelKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.watend',
      },
      {
        pfad: 'befischte_bereiche.ges_gew_vom_ufer',
        labelKey: 'protokoll.abschnitt5.bereiche.gesamteBreite.vomUfer',
      },
    ],
  },
  {
    legendKey: 'protokoll.abschnitt5.bereiche.entlangUfer.legend',
    laenge: 'befischte_bereiche.ufer_laenge',
    breite: 'befischte_bereiche.ufer_breite',
    richtung: [
      {
        pfad: 'befischte_bereiche.ufer_stromauf',
        labelKey: 'protokoll.abschnitt5.bereiche.entlangUfer.stromauf',
      },
      {
        pfad: 'befischte_bereiche.ufer_stromab',
        labelKey: 'protokoll.abschnitt5.bereiche.entlangUfer.stromab',
      },
    ],
    methode: [
      {
        pfad: 'befischte_bereiche.ufer_vom_boot',
        labelKey: 'protokoll.abschnitt5.bereiche.entlangUfer.vomBoot',
      },
      {
        pfad: 'befischte_bereiche.ufer_watend',
        labelKey: 'protokoll.abschnitt5.bereiche.entlangUfer.watend',
      },
      {
        pfad: 'befischte_bereiche.ufer_vom_ufer',
        labelKey: 'protokoll.abschnitt5.bereiche.entlangUfer.vomUfer',
      },
    ],
  },
]

/* Where part 5's rule messages attach.
 *
 * Each of the three is about a pair of fields rather than either one of them, so
 * no path in the answers document names the thing that is wrong. Exactly the
 * situation teil3/gruppen.ts met with the percentage totals and teil4/bloecke.ts
 * met with the Einflüsse contradiction, and it is solved the same way: a path
 * outside the document, carried through Regelverstoss and matched by the block
 * that renders the message.
 *
 * The prefix keeps them out of the way of any real field path, which is what
 * lets React Hook Form hold the error without a field claiming it. */
export const ANODEN_PAAR = 'paar.anoden' as const
export const LAENGE_PAAR = 'paar.befischte_laenge' as const
export const BREITE_PAAR = 'paar.befischte_breite' as const

export type Paarpfad = typeof ANODEN_PAAR | typeof LAENGE_PAAR | typeof BREITE_PAAR

/* The two fields each pair is about, so the message component and the rule can
 * never drift onto different fields. The two fished area pairs are read off
 * BEFISCHTE_BEREICHE rather than retyped, which is the whole reason that
 * declaration exists.
 *
 * Note that the pairs run across the rows, not down them: the two lengths are
 * checked against each other and the two widths against each other, never a row
 * against itself. That is the legacy form's own pairing. regeln/ausruestung.ts
 * says why it is kept. */
const [GESAMTE_BREITE, ENTLANG_UFER] = BEFISCHTE_BEREICHE

export type Feldpaar = readonly [AntwortPfad, AntwortPfad]

export const ANODEN_FELDER: Feldpaar = [
  'ausruestung.ringanoden',
  'ausruestung.streifenanoden',
]

export const LAENGE_FELDER: Feldpaar = [GESAMTE_BREITE.laenge, ENTLANG_UFER.laenge]
export const BREITE_FELDER: Feldpaar = [GESAMTE_BREITE.breite, ENTLANG_UFER.breite]

/* Every answer in part 5 that is a quantity rather than a word or a tick.
 *
 * All nine measure something that has no negative: a voltage, a power output,
 * a count of anodes, a diameter, a length, a width. regeln/ausruestung.ts holds
 * them to that.
 *
 * The legacy form checks none of them, and neither does its JavaScript
 * anywhere: no keystroke handler, no format check, no range. So a fished length
 * of -50 reaches FiaKa today. This is a deliberate narrowing rather than a port,
 * added on 2026-09-04, and unlike the Bauweise question it needs nothing from
 * FFS: no survey can report a negative count of anodes. Anything tighter, such
 * as a plausible ceiling on voltage, is theirs to answer and is not set here. */
export const ZAHLENFELDER: readonly AntwortPfad[] = [
  'ausruestung.spannung',
  'ausruestung.leistung',
  'ausruestung.ringanoden',
  'ausruestung.ringanoden_durchmesser',
  'ausruestung.streifenanoden',
  ...LAENGE_FELDER,
  ...BREITE_FELDER,
]
