/* A protocol that has been opened but not yet created.
 *
 * Until 2026-09-10, clicking "Neues Protokoll" wrote a record to the server
 * before the surveyor had typed a character. Open it, change your mind, go back,
 * and the list had gained an empty protocol nobody wanted. That litter is what
 * this exists to prevent: the record is created by the first thing typed into
 * it, and a protocol nobody typed into never exists at all.
 *
 * The stand-in carries the same shape as a real draft so that every component
 * between here and the fields works unchanged. Only three things know the
 * difference: the automatic save, which creates the record on its first write,
 * the save indicator, which says so, and the page, which asks before leaving.
 */

import type { Entwurf } from './typen'

/* Sits where a protocol id sits, in the address and in the draft. A word rather
 * than an empty string or null, because it travels through the same route
 * parameter as a real id and has to be readable in the address bar: a surveyor
 * on /protokolle/neu/abschnitt/1 can see what they are looking at.
 *
 * It can never collide with a real protocol: those are UUIDs, so "neu" is not a
 * value the server can hand back.
 */
export const NEU = 'neu'

export function istNeu(id: string | undefined): boolean {
  return id === NEU
}

/* The empty stand-in.
 *
 * version 0 is deliberate and never sent anywhere. The server's own versions
 * start at 1, and the first save replaces this whole object with what the server
 * answers, so a 0 reaching an endpoint would be a bug rather than a conflict.
 *
 * form_version is empty because only the server knows which form version is
 * current, and it stamps the record when it creates it. ProtokollKopf leaves the
 * line out rather than printing a blank.
 */
export function leererEntwurf(): Entwurf {
  const jetzt = new Date().toISOString()

  return {
    id: NEU,
    status: 'DRAFT',
    form_version: '',
    version: 0,
    antworten: {},
    created_at: jetzt,
    updated_at: jetzt,
  }
}

/* Whether navigating to this address means leaving the protocol behind.
 *
 * Its own function so it can be tested without React and without a router. The
 * question matters because moving between sections is not leaving: the section
 * bar changes the address on every click, and asking "verwerfen?" each time
 * somebody looks at section 3 would make the question meaningless by the third
 * time they saw it.
 *
 * Everything under /protokolle/ is still inside a protocol, including the
 * address the record gets the moment it is created. Anything else, the list
 * above all, is the way out.
 */
export function verlaesstProtokoll(pfad: string): boolean {
  return !pfad.startsWith('/protokolle/')
}
