/* Whether the protocol on screen is being read rather than filled in.
 *
 * A context rather than a prop, and this is the whole reason the read-only view
 * could reuse the form at all. The answer is needed by the eleven field
 * components at the bottom of the tree and by none of the 26 block components
 * between here and them, so threading a boolean through all of them would mean
 * touching every block to carry something no block cares about.
 *
 * **This does not contradict coding-standards.md's rule against a context here.**
 * That rule is about form *values*, which stay in React Hook Form because
 * re-rendering 338 fields on every keystroke makes typing sticky. This is one
 * boolean that is fixed for the life of the page and never changes at all, so it
 * causes no re-render after the first.
 *
 * It defaults to false, so every existing use of the form is unaffected by
 * nothing more than not having a provider above it.
 */

import { createContext, use } from 'react'

export const NurLesenKontext = createContext(false)

/** Whether this field should draw itself as text instead of as a control. */
export function useNurLesen(): boolean {
  return use(NurLesenKontext)
}
