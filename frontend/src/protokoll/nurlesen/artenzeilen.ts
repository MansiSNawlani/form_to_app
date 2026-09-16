import { ARTNUMMERN, KLASSEN } from '../abschnitte/teil6/tabelle'
import { zeileIstLeer } from '../abschnitte/teil6/zeilen'
import type { Artengruppe } from '../abschnitte/teil6/zeilen'
import type { Artnummer } from '../entwurf/typen'

/* Which catch rows a reviewer is shown, and what is in each.
 *
 * A plain function over the answers, so the decision can be tested without a
 * table. It has a wrong answer available to it in both directions: showing rows
 * nobody filled in buries the real ones, and hiding a row that holds counts
 * would take recorded animals off a reviewer's screen entirely.
 */

export interface Fangzeile {
  /** The row number, as the printed form and the eventual FiaKa transfer count. */
  nr: Artnummer
  /** The stored species code, or undefined where the row has counts but no species. */
  code: string | undefined
  /** The ten size classes, ascending, exactly as stored. */
  klassen: readonly (string | undefined)[]
  /** The young-of-year count, a subset of the ten beside it rather than an eleventh. */
  nullPlus: string | undefined
}

/* Every row holding anything at all, in order.
 *
 * **Anything, not just a species.** The form opens twenty-six slots and a
 * surveyor uses four, so printing all of them would bury the four real rows
 * under twenty-two rows of dashes; the printed form's repeated-slot count is not
 * a target. But a row carrying counts and no species is not an empty slot, it is
 * a filled-in row with a question hanging over it, and that question is very
 * often exactly why a reviewer would send the protocol back. It is shown, with
 * the species cell saying nothing was given.
 *
 * The four "no detection" codes need no special case. A row carrying OFAN is a
 * row carrying a species as far as this is concerned, and it prints its label
 * like any other; what those codes mean is feature 9b's business and was settled
 * before the protocol was ever submitted.
 */
export function fangzeilen(arten: Artengruppe | undefined): readonly Fangzeile[] {
  return ARTNUMMERN.filter((nr) => !zeileIstLeer(arten?.[`art${nr}`])).map((nr) => {
    const zeile = arten?.[`art${nr}`]

    return {
      nr,
      code: zeile?.name,
      klassen: KLASSEN.map(({ feld }) => zeile?.[feld]),
      nullPlus: zeile?.['0plus'],
    }
  })
}
