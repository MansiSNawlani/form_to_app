/* Making sure a protocol exists on the server before something is hung off it.
 *
 * Since 2026-09-10 a protocol is created by the first thing typed into it, so
 * that opening "Neues Protokoll" and changing your mind leaves nothing behind.
 * `useAutoSave` does that for the answers: the first keystroke turns the
 * stand-in into a record.
 *
 * Section 7 has no fields to type in. Attaching a photograph is putting
 * something into the protocol just as plainly as typing is, and it cannot be
 * done at all until there is a record to attach it to, because an attachment is
 * addressed through its protocol. This is that same moment for the other half of
 * the form.
 *
 * **One protocol however many callers ask at once.** Both blocks in section 7
 * hold their own `useAnlagen`, and the Fotos picker takes several files in one
 * go, so "create it if it is not there" can be asked several times within a few
 * milliseconds. Each of those checking and then creating would leave a surveyor
 * with two or three empty protocols and their pictures scattered over them. The
 * in-flight promise is shared instead, so every caller waits on the same POST
 * and gets the same id back.
 *
 * Nothing here touches React, so the part where a wrong answer is possible can
 * be tested without a browser, which is what coding-standards.md asks for.
 */

import { istNeu } from './neu'
import type { Entwurf } from './typen'

/* Hands back the protocol's real id, creating the record first if need be.
 *
 * The id is an argument rather than something the provider remembers, and that
 * is deliberate. It changes during the life of one page: the placeholder until
 * something is put into the protocol, the real one from then on. A value
 * captured when the provider was built would go on claiming the protocol does
 * not exist long after it did, and keeping it in a ref instead would mean
 * reading that ref while rendering. The caller always has the current id to
 * hand, so it passes it.
 */
export type Bereitsteller = (aktuelleId: string) => Promise<string>

export interface BereitstellerOptionen {
  anlegen: () => Promise<Entwurf>
  /* Told once, when a record comes into being. The page puts the new draft in
     the cache and swaps the address bar, exactly as it does when the first
     keystroke creates one. */
  onAngelegt: (entwurf: Entwurf) => void
}

export function erstelleBereitsteller({
  anlegen,
  onAngelegt,
}: BereitstellerOptionen): Bereitsteller {
  let laufend: Promise<string> | null = null

  return async (aktuelleId: string) => {
    if (!istNeu(aktuelleId)) return aktuelleId

    /* A second caller arriving while the first request is open joins it rather
       than starting another. */
    laufend ??= anlegen()
      .then((entwurf) => {
        onAngelegt(entwurf)
        return entwurf.id
      })
      .catch((fehler: unknown) => {
        /* Cleared on the way out, so a failed attempt does not poison every
           later one. The surveyor's next pick should try again rather than be
           handed the same rejection forever. */
        laufend = null
        throw fehler
      })

    return laufend
  }
}
