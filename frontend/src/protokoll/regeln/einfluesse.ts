import { istLeer, type Regel, type Regelverstoss } from './regel'
import {
  BLANKETT_EINFLUESSE,
  EINFLUSS_WIDERSPRUCH,
  NUTZUNGEN,
} from '../abschnitte/teil4/bloecke'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The Nutzungsbedingte Einflüsse cannot say two things at once.
 *
 * "keine (erkennbar)" and "unbekannt" are both blanket answers: each says there
 * is nothing in the list below to tick. So neither can stand beside a named use,
 * and they cannot stand beside each other, because "there are none" and "we do
 * not know" are different claims.
 *
 * The legacy form allows all of it and checks nothing anywhere in part 4. This
 * rule is ours, added by decision on 2026-09-04. It is not in
 * docs/ffs-defect-list.md, because permitting a contradiction is a gap in what
 * the form asks for rather than something that corrupted a record that was
 * entered.
 *
 * Nothing is cleared and nothing is blocked. regeln/prozent.ts already settled
 * that for part 3 and wrote down why: the legacy form refuses the keystroke that
 * would push a run past 100, and refusing it makes an ordinary correction
 * impossible. Silently emptying thirteen checkboxes because somebody mis-clicked
 * one is the same failure in a worse form, on a protocol that is filled in over
 * several sittings. The contradiction is shown; which answer was wrong is the
 * surveyor's to decide.
 */

/** A checkbox holds "Ja" when ticked and the empty string when not. */
function istGesetzt(antworten: Antworten, pfad: AntwortPfad): boolean {
  const gruppe = antworten.einfluesse
  if (!gruppe) return false
  const schluessel = pfad.slice('einfluesse.'.length) as keyof typeof gruppe
  return !istLeer(gruppe[schluessel])
}

export function pruefeWiderspruch(antworten: Antworten): Regelverstoss[] {
  const [keine, unbekannt] = BLANKETT_EINFLUESSE
  const keineGesetzt = istGesetzt(antworten, keine)
  const unbekanntGesetzt = istGesetzt(antworten, unbekannt)

  // An untouched block is not a wrong block, the same convention istLeer carries
  // everywhere else on the protocol.
  if (!keineGesetzt && !unbekanntGesetzt) return []

  /* Both blanket answers at once is its own mistake and gets its own message.
     Reported instead of the other one rather than alongside it: two messages in
     one line for one confused block would not tell the reader what to do
     first. */
  if (keineGesetzt && unbekanntGesetzt) {
    return [
      {
        pfad: EINFLUSS_WIDERSPRUCH,
        schluessel: 'protokoll.regeln.einfluesseBeideBlankett',
      },
    ]
  }

  if (!NUTZUNGEN.some((pfad) => istGesetzt(antworten, pfad))) return []

  return [
    {
      pfad: EINFLUSS_WIDERSPRUCH,
      schluessel: keineGesetzt
        ? 'protokoll.regeln.einfluesseKeineUndNutzung'
        : 'protokoll.regeln.einfluesseUnbekanntUndNutzung',
    },
  ]
}

export const pruefeEinfluesse: Regel = (antworten) => pruefeWiderspruch(antworten)
