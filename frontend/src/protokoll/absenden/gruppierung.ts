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
  /* Answers an import could not take over, which are not the same thing as a
     rule complaining and are never merged into the list above.
     
     A violation means the answer is wrong or missing. This means the answer is
     there, exactly as the PDF wrote it, and this application could not make
     sense of it. Telling somebody their date is missing when it is sitting in
     the box in front of them sends them looking for the wrong problem. Empty
     for a protocol nobody imported, which is nearly all of them. */
  unbrauchbar: Problem[]
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

/* The key every unusable answer carries, since they all say the same thing:
   the value is in the protocol as the file wrote it and could not be read.
   A constant rather than a field on Problem, because unlike a violation there
   is nothing per-entry to say. */
export const UNBRAUCHBAR_SCHLUESSEL = 'protokoll.einlesen.unbrauchbar.text'

export function gruppiere(
  verstoesse: readonly Verstoss[],
  /* The paths somebody has put something into since the refusal. Passed in
     rather than read here, so this stays a plain function over values and the
     component decides what counts as filled in. */
  erledigtePfade: ReadonlySet<string> = new Set(),
  /* Field paths an import could not take over. Empty for every protocol that
     was typed in rather than imported, which is nearly all of them. */
  unbrauchbarePfade: readonly string[] = [],
): Problemliste {
  /* A fresh object each time rather than a shared empty one. The arrays in it
     are mutable, so a single shared instance handed out repeatedly is one
     accidental push away from every later empty result carrying somebody else's
     problems. */
  if (verstoesse.length === 0 && unbrauchbarePfade.length === 0) {
    return { gruppen: [], unverortet: [], anzahl: 0, offen: 0 }
  }

  const gruppen = new Map<Abschnittsnummer, Abschnittsgruppe>()
  const unverortet: Problem[] = []

  /* One place that files an entry, so a violation and an unusable answer can
     never end up sorted, counted or placed by two different rules. */
  function lege(problem: Problem, abschnitt: Abschnittsnummer | null, spalte: 'probleme' | 'unbrauchbar') {
    if (abschnitt === null) {
      unverortet.push(problem)
      return
    }

    let gruppe = gruppen.get(abschnitt)
    if (gruppe === undefined) {
      gruppe = { nr: abschnitt, titelKey: titelVon(abschnitt), probleme: [], unbrauchbar: [] }
      gruppen.set(abschnitt, gruppe)
    }
    gruppe[spalte].push(problem)
  }

  for (const verstoss of verstoesse) {
    const { abschnitt, labelKey } = verorte(verstoss.pfad)
    lege(
      {
        pfad: verstoss.pfad,
        schluessel: verstoss.schluessel,
        labelKey,
        artnummer: artnummerAus(verstoss.pfad),
        erledigt: erledigtePfade.has(verstoss.pfad),
      },
      abschnitt,
      'probleme',
    )
  }

  /* After the violations, so a field that is both unreadable and refused by a
     rule keeps its rule entry in the list people read first.
     
     Both are shown rather than one suppressed: they say different things, and
     an unreadable value that also breaks a rule needs retyping for both
     reasons. */
  for (const pfad of unbrauchbarePfade) {
    const { abschnitt, labelKey } = verorte(pfad)
    lege(
      {
        pfad,
        schluessel: UNBRAUCHBAR_SCHLUESSEL,
        labelKey,
        artnummer: artnummerAus(pfad),
        /* Never ticks off, unlike a violation, and this is the one place the
           two genuinely have to behave differently.

           A violation ticks off when its box stops being empty, which is a fair
           signal that somebody has dealt with it. That signal says nothing here:
           the backend stores the unreadable value in the field exactly as the
           PDF wrote it, so the box is already full on arrival and the entry
           would tick itself off before anybody had looked at it. The one thing
           the surveyor must do is precisely the thing the emptiness test cannot
           see.

           Telling them apart would need the imported value to compare against,
           and this store deliberately holds no answers. So an unusable answer
           stays listed until a fresh Absenden, where the server either accepts
           the value or says what is wrong with it. That is the same rule the
           block-level violations already live by, and the panel's own rule that
           only a fresh check replaces the list with the truth. */
        erledigt: false,
      },
      abschnitt,
      'unbrauchbar',
    )
  }

  return {
    /* Section order, not the order the problems arrived in. The server already
       sends them in form order, but a rule that judges two parts at once, such
       as the hydrology one reading the water type from part 1, would otherwise
       put part 2 ahead of part 1 in the list. */
    gruppen: [...gruppen.values()].sort((eine, andere) => eine.nr - andere.nr),
    unverortet,
    anzahl: verstoesse.length + unbrauchbarePfade.length,
    /* Unusable answers always count as open: see the note above about why the
       "box is no longer empty" test cannot see the work they need. */
    offen:
      verstoesse.filter((verstoss) => !erledigtePfade.has(verstoss.pfad)).length +
      unbrauchbarePfade.length,
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
  /* Counted alongside the violations rather than separately, so a section whose
     only outstanding work is a date the import could not read still carries a
     marker. Without it that section reads as finished and the value sits there
     unlooked at until a reviewer finds it. */
  unbrauchbarePfade: readonly string[] = [],
): ReadonlyMap<Abschnittsnummer, number> {
  const offen = new Map<Abschnittsnummer, number>()

  for (const verstoss of verstoesse) {
    if (erledigtePfade.has(verstoss.pfad)) continue
    const { abschnitt } = verorte(verstoss.pfad)
    if (abschnitt === null) continue
    offen.set(abschnitt, (offen.get(abschnitt) ?? 0) + 1)
  }

  /* Never filtered by erledigtePfade, for the reason gruppiere states: the
     backend stores an unreadable value in its field, so the box is full on
     arrival and the emptiness test would clear the marker before anybody had
     looked at it. */
  for (const pfad of unbrauchbarePfade) {
    const { abschnitt } = verorte(pfad)
    if (abschnitt === null) continue
    offen.set(abschnitt, (offen.get(abschnitt) ?? 0) + 1)
  }

  return offen
}
