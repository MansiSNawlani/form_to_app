import type { ParseKeys } from 'i18next'
import type { Gruppenpfad } from '../abschnitte/teil3/gruppen'
import type { Einflusspfad } from '../abschnitte/teil4/bloecke'
import type { Paarpfad } from '../abschnitte/teil5/bloecke'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* A rule is a plain function from the answers document to what is wrong with
 * it, holding no React, no Zod and no German. That keeps it testable without a
 * browser, and it lets the backend read the same rule straight across into
 * Pydantic once features 2 and 3 land, because both halves see the same
 * document.
 *
 * A key rather than a sentence, because a sentence built in here could not be
 * translated for feature 17.
 */
export interface Regelverstoss {
  /* Usually a field. A path outside the answers document where the wrong thing
     is a combination rather than any one answer in it: the six percentage runs
     of part 3, whose total is nobody's field, and part 4's Einflüsse block,
     where the contradiction is between two ticks rather than in either. In both
     cases no path in the document names the thing that is wrong, and turning
     every box in the group red for one problem is noise. See gruppen.ts and
     teil4/bloecke.ts. Part 5 adds three more, where the wrong thing is a pair of
     numbers that between them say nothing; see teil5/bloecke.ts. */
  pfad: AntwortPfad | Gruppenpfad | Einflusspfad | Paarpfad
  schluessel: ParseKeys
}

export type Regel = (antworten: Antworten) => Regelverstoss[]

/** Blank is untouched, and untouched is never wrong in a draft. */
export function istLeer(wert: string | undefined): boolean {
  return (wert ?? '').trim() === ''
}

/* One answer out of the document, addressed by its path.
 *
 * A rule that works over a declared run of fields has paths rather than the
 * values behind them, so it needs this. A walk rather than two fixed lookups,
 * because AntwortPfad is any depth the document has: part 1 already nests three
 * deep at probestrecke.gewaesser.vorfluter1.
 *
 * Returns "" for anything missing, which istLeer then reads as untouched. That
 * is the same answer a present-but-empty field gives, and nothing on this form
 * yet distinguishes the two; typen.ts says so.
 */
export function wertAus(antworten: Antworten, pfad: AntwortPfad): string {
  const wert = pfad
    .split('.')
    .reduce<unknown>(
      (aktuell, teil) => (aktuell as Record<string, unknown> | undefined)?.[teil],
      antworten,
    )
  return typeof wert === 'string' ? wert : ''
}

/* An answer read as a number, however it was written.
 *
 * A count is typed as "0" and a length can be "0", "0,0" or "0.0", since the
 * form is German and the input is not. Whitespace survives a paste.
 *
 * undefined for blank, and for anything that is not a number at all. The two
 * are not distinguished here because the callers disagree about what they mean:
 * regeln/ausruestung.ts treats both as "no answer", while regeln/arten.ts counts
 * a blank cell as nothing and refuses to total a column holding a word. Each
 * asks istLeer first when it needs to tell them apart.
 *
 * Moved here from ausruestung.ts during feature 9a, when the catch table needed
 * the same parse. The same move wertAus made out of prozent.ts when part 5
 * arrived, and for the same reason: two copies of a number parser is how the
 * two halves of a form quietly start disagreeing about what a value is.
 */
export function alsZahl(wert: string | undefined): number | undefined {
  const roh = (wert ?? '').trim().replace(',', '.')
  if (roh === '') return undefined
  const zahl = Number(roh)
  return Number.isFinite(zahl) ? zahl : undefined
}
