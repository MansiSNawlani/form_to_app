/* Where an account starts.
 *
 * Until feature 12b there was one home page for everybody, because there was only
 * one list. There are now two, and they answer different questions: Meine
 * Protokolle is "what have I got", the Pruefliste is "what is waiting for FFS".
 * Somebody whose job is other people's protocols should not have to navigate away
 * from a list of their own the moment they sign in.
 *
 * A plain function over a list of roles, so it can be held to its promise without
 * React and without a browser, which is what coding-standards.md asks wherever a
 * wrong answer is possible. Two wrong answers are available: sending a surveyor to
 * a page that refuses them, and sending a reviewer to a list that is almost always
 * empty for them.
 *
 * This decides a starting point, never a permission. What either page will show is
 * the server's to answer, and the Pruefliste refuses an account that has no
 * business with it whether or not this function ever sends one there.
 */

import type { Rolle } from '../api/typen'
import { sichererWeiterPfad } from './weiter'

/** Meine Protokolle, and the default for everybody else. */
export const MEINE_PROTOKOLLE = '/'

/** The review queue. */
export const PRUEFLISTE = '/pruefung'

/* The three accounts whose job is other people's protocols, the same three
 * FFS_ROLLEN in backend/app/protokolle/dienst.py names and the same three the
 * Pruefliste endpoint admits.
 *
 * REGIERUNGSPRAESIDIUM is deliberately not among them. That role is read-only over
 * its own region, the endpoint refuses it today, and feature 13 is where it gets a
 * view of its own. Landing it on a page that refuses it would be a worse first
 * impression than landing it on a list.
 */
const FFS_ROLLEN: readonly Rolle[] = ['REVIEWER', 'DATA_STEWARD', 'SUPER_ADMIN']

/* Whether this account's job is other people's protocols.
 *
 * One answer to "who is FFS staff" in the browser, the same way the backend keeps
 * one in FFS_ROLLEN rather than retyping three roles per route. The header reads
 * it to decide whether to draw the Pruefliste link, and startseite below reads it
 * to decide where to land.
 *
 * **Never a permission.** Hiding a link is not security, and the endpoint refuses
 * an account that has no business with the queue whether or not the link was
 * drawn. This only keeps a header from offering somebody a page that would turn
 * them away.
 */
export function darfPruefen(rollen: readonly Rolle[]): boolean {
  return rollen.some((rolle) => FFS_ROLLEN.includes(rolle))
}

export function startseite(rollen: readonly Rolle[]): string {
  return darfPruefen(rollen) ? PRUEFLISTE : MEINE_PROTOKOLLE
}

/* Where to go once somebody has signed in.
 *
 * A page they actually asked for always wins, so following a link to a protocol
 * while signed out still lands on that protocol. Only when there was no particular
 * page does the account's own starting point decide.
 *
 * weiter.ts leaves the parameter off for the home page, so "no parameter" and "the
 * home page" are the same thing here, and both mean "no particular page". A
 * reviewer whose session ran out on Meine Protokolle therefore comes back to the
 * Pruefliste, which is the right answer: the parameter means one particular page,
 * and where an account starts is what this decides.
 */
export function zielNachAnmeldung(roh: string | null, rollen: readonly Rolle[]): string {
  const gewuenscht = sichererWeiterPfad(roh)
  return gewuenscht === MEINE_PROTOKOLLE ? startseite(rollen) : gewuenscht
}
