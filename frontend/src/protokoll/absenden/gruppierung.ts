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
  /** Every problem, however it was filed. What the count line says. */
  anzahl: number
}

export function gruppiere(verstoesse: readonly Verstoss[]): Problemliste {
  /* A fresh object each time rather than a shared empty one. The arrays in it
     are mutable, so a single shared instance handed out repeatedly is one
     accidental push away from every later empty result carrying somebody else's
     problems. */
  if (verstoesse.length === 0) return { gruppen: [], unverortet: [], anzahl: 0 }

  const gruppen = new Map<Abschnittsnummer, Abschnittsgruppe>()
  const unverortet: Problem[] = []

  for (const verstoss of verstoesse) {
    const { abschnitt, labelKey } = verorte(verstoss.pfad)
    const problem: Problem = {
      pfad: verstoss.pfad,
      schluessel: verstoss.schluessel,
      labelKey,
      artnummer: artnummerAus(verstoss.pfad),
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
