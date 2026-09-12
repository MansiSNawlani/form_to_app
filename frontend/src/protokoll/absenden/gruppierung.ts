/* The refused answers, arranged the way the panel prints them.
 *
 * A plain function over values, so the part where a wrong answer is possible can
 * be tested without a browser, the arrangement coding-standards.md asks for. A
 * wrong answer is available here: a problem filed under the wrong section sends
 * somebody to the wrong screen, and a duplicate makes one mistake look like two.
 */

import type { ParseKeys } from 'i18next'
import type { Verstoss } from '../../api/typen'
import { ABSCHNITTE } from '../abschnitte'
import { artnummerAus, verorte, type Abschnittsnummer } from './verortung'

export interface Problem {
  /** The path, which is also the field's DOM id, so a link can reach it. */
  pfad: string
  /** What is wrong, as a key under protokoll.regeln. */
  schluessel: string
  /** What the field is called. null when we have no name for it. */
  labelKey: ParseKeys | null
  /** The catch row this sits in, for naming it. null for everything else. */
  artnummer: number | null
  /* Something has been typed into this field since the server refused it.
   *
   * Deliberately not "this is now correct". The browser can see that a box is no
   * longer empty; whether the value is right is the server's to say, because the
   * rules live there. So this ticks an entry off as dealt with and never as
   * passed, and only a fresh check replaces the list with the truth.
   *
   * Always false for a problem that names a block rather than a field, such as a
   * percentage run or a tick group: there is no single box whose emptiness would
   * answer the question. */
  erledigt: boolean
}

export interface Abschnittsgruppe {
  nr: Abschnittsnummer
  titelKey: ParseKeys
  probleme: Problem[]
}

export interface Problemliste {
  gruppen: Abschnittsgruppe[]
  /* Problems we could not place in any section. Listed rather than dropped: a
     rule added to the backend and not to verortung.ts would otherwise go
     silently missing, and a violation nobody can see is worse than one nobody
     can click. */
  unverortet: Problem[]
  /** Every problem, however it was filed. */
  anzahl: number
  /** How many are still untouched. What the count line says. */
  offen: number
}

export function gruppiere(
  verstoesse: readonly Verstoss[],
  /* The paths somebody has put something into since the refusal. Passed in
     rather than read here, so this stays a plain function over values and the
     component decides what counts as filled in. */
  erledigtePfade: ReadonlySet<string> = new Set(),
): Problemliste {
  /* A fresh object each time rather than a shared empty one. The arrays in it
     are mutable, so a single shared instance handed out repeatedly is one
     accidental push away from every later empty result carrying somebody else's
     problems. */
  if (verstoesse.length === 0) {
    return { gruppen: [], unverortet: [], anzahl: 0, offen: 0 }
  }

  const gruppen = new Map<Abschnittsnummer, Abschnittsgruppe>()
  const unverortet: Problem[] = []

  for (const verstoss of verstoesse) {
    const { abschnitt, labelKey } = verorte(verstoss.pfad)
    const problem: Problem = {
      pfad: verstoss.pfad,
      schluessel: verstoss.schluessel,
      labelKey,
      artnummer: artnummerAus(verstoss.pfad),
      erledigt: erledigtePfade.has(verstoss.pfad),
    }

    if (abschnitt === null) {
      unverortet.push(problem)
      continue
    }

    const vorhanden = gruppen.get(abschnitt)
    if (vorhanden === undefined) {
      gruppen.set(abschnitt, {
        nr: abschnitt,
        titelKey: titelVon(abschnitt),
        probleme: [problem],
      })
    } else {
      vorhanden.probleme.push(problem)
    }
  }

  return {
    /* Section order, not the order the problems arrived in. The server already
       sends them in form order, but a rule that judges two parts at once, such
       as the hydrology one reading the water type from part 1, would otherwise
       put part 2 ahead of part 1 in the list. */
    gruppen: [...gruppen.values()].sort((eine, andere) => eine.nr - andere.nr),
    unverortet,
    anzahl: verstoesse.length,
    offen: verstoesse.filter((verstoss) => !erledigtePfade.has(verstoss.pfad)).length,
  }
}

function titelVon(nr: Abschnittsnummer): ParseKeys {
  const abschnitt = ABSCHNITTE.find((eintrag) => eintrag.nr === nr)
  /* Every number verortung.ts can produce is one of the seven, so the fallback
     is unreachable rather than a case anybody meets. It is here because the
     alternative is a non-null assertion, which would be a promise the type
     system cannot check. */
  return abschnitt?.titelKey ?? 'protokoll.abschnitte.anlass'
}


/* How many problems are still outstanding in each section.
 *
 * What the step bar prints beside each section number, so somebody can see where
 * the remaining work is without a list of every entry in front of them. A section
 * with nothing outstanding is absent from the map rather than present with a
 * zero, so the bar shows a marker only where there is something to mark.
 *
 * Counts what is still open, not what the server last found: an entry ticks off
 * as its field is filled, and the count follows. The badge therefore says
 * "nothing left to type here" and never "this section is correct", which only a
 * fresh check can say. Problems naming a block rather than a field never tick
 * off, so a section keeps its marker until the server agrees.
 */
export function offeneJeAbschnitt(
  verstoesse: readonly Verstoss[],
  erledigtePfade: ReadonlySet<string> = new Set(),
): ReadonlyMap<Abschnittsnummer, number> {
  const offen = new Map<Abschnittsnummer, number>()

  for (const verstoss of verstoesse) {
    if (erledigtePfade.has(verstoss.pfad)) continue
    const { abschnitt } = verorte(verstoss.pfad)
    if (abschnitt === null) continue
    offen.set(abschnitt, (offen.get(abschnitt) ?? 0) + 1)
  }

  return offen
}
