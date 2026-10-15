/* The server's last refusal, by path, for the fields to find themselves in.
 *
 * A context rather than a prop for the reason nurlesen/kontext.ts gives: the
 * fields at the bottom of the tree want it and none of the blocks between here
 * and them do.
 *
 * **This does not contradict coding-standards.md's rule against a context for
 * form state.** The value changes when a submit or an import answers, never on a
 * keystroke, so it re-renders the fields once per Absenden and not while
 * somebody types.
 *
 * Empty by default, so the review screen and anything else without a provider
 * shows no refusals at all.
 */

import { createContext, use } from 'react'
import type { Verstoss } from '../../api/typen'

const KEINE: ReadonlyMap<string, string> = new Map()

export const VerstossKontext = createContext<ReadonlyMap<string, string>>(KEINE)

/** Path to message key. A path the server named twice keeps its first message. */
export function verstossKarte(verstoesse: readonly Verstoss[]): ReadonlyMap<string, string> {
  if (verstoesse.length === 0) return KEINE

  const karte = new Map<string, string>()
  for (const { pfad, schluessel } of verstoesse) {
    if (!karte.has(pfad)) karte.set(pfad, schluessel)
  }
  return karte
}

/** What the server said about this path at the last submit, as an unchecked key. */
export function useServerVerstoss(pfad: string): string | undefined {
  return use(VerstossKontext).get(pfad)
}
