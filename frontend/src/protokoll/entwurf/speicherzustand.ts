/* What the header says when the answers and the attachments each have something
 * to report.
 *
 * There is one indicator, not two. It speaks for the whole protocol, so a
 * photograph that has landed makes it read "gespeichert um 09:14" exactly as a
 * typed answer does. Decided on 2026-09-11, after finding that uploading a
 * photograph drove nothing in the header at all: project-overview.md requires
 * that saving is automatic and its state is always visible, and an upload is
 * saving.
 *
 * The cost, accepted knowingly: the time no longer refers only to the answers.
 * Two indicators side by side would be worse, because the question a surveyor is
 * asking is "is my work safe", not "which half of my work is safe".
 *
 * A plain function rather than something inside a component, because the
 * precedence is where a wrong answer is possible and it needs no React to be
 * asked. The costly mistakes are both of the same kind: hiding a problem behind
 * a cheerful "gespeichert".
 */

import type { SaveState } from './useAutoSave'

/* An attachment never reports a failure here, which is why this is narrower than
 * SaveState. The block already shows one message per refused file, naming the
 * file and what to do about it, and the header could only say something vaguer
 * about work that is in fact perfectly safe. Two messages for one event is how
 * the useful one gets missed. */
export type Anlagenzustand =
  | { status: 'saving' }
  | { status: 'saved'; zeitpunkt: string }
  | null

function istProblem(zustand: SaveState): boolean {
  return zustand.status === 'failed' || zustand.status === 'conflict'
}

export function anzeigeZustand(formular: SaveState, anlagen: Anlagenzustand): SaveState {
  // 1. Anything still in flight wins. Somebody watching wants to know work is
  //    being done before they want to know when it was last done.
  if (anlagen?.status === 'saving' || formular.status === 'saving') {
    return { status: 'saving' }
  }

  // 2. A problem with the answers outranks a picture that landed. A conflict is
  //    the one failure a person has to act on, and a photograph arriving a
  //    moment later must never be what covers it up.
  if (istProblem(formular)) return formular

  if (anlagen?.status === 'saved') {
    // 3. Whichever happened last. Both are ISO from the server, so comparing
    //    them as strings is comparing them as times.
    if (formular.status === 'saved' && formular.zeitpunkt > anlagen.zeitpunkt) {
      return formular
    }
    /* This also covers the case that surprised us into writing this function: a
       protocol whose answers have never been saved, because the surveyor went
       straight to section 7. The form still calls itself "ungespeichert", and
       saying so beside a photograph sitting on the server would be wrong. */
    return anlagen
  }

  // 4. Nothing to add, so the form speaks for itself.
  return formular
}
