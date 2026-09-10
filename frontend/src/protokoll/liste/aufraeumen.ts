/* What a deleted draft leaves behind in this browser, and how it goes.
 *
 * Two things outlive the server record. The safety copy holds whatever was typed
 * when a save last failed, and the attachments are the photographs and the map
 * excerpt, which feature 10 put in the browser's own database and feature 3d
 * will move to the server. Both are keyed by the draft's id, and once the
 * protocol is gone there is no screen that lists either of them again, so
 * anything left here is left for good.
 *
 * Best effort throughout, and that is the whole design. By the time this runs
 * the protocol is already gone from the server: the delete succeeded, and the
 * person is owed the row disappearing rather than a message about a database
 * this app only ever used as a stopgap. A browser refusing to open IndexedDB, in
 * a private window or a locked-down profile, must not turn a completed delete
 * into a failure.
 *
 * The stores are arguments rather than imports, so this is testable without a
 * browser, the same arrangement sicherung.ts and anlagen/store.ts already use.
 */

import type { AnlagenStore } from '../anlagen/store'
import type { SicherungsStore } from '../entwurf/sicherung'

export interface Aufraeumstores {
  sicherungen: Pick<SicherungsStore, 'loesche'>
  anlagen: Pick<AnlagenStore, 'listAnlagen' | 'removeAnlage'>
}

export async function raeumeBrowserAuf(
  entwurfId: string,
  { sicherungen, anlagen }: Aufraeumstores,
): Promise<void> {
  // Swallows its own failures already, and is synchronous localStorage.
  sicherungen.loesche(entwurfId)

  try {
    const gefunden = await anlagen.listAnlagen(entwurfId)
    if (gefunden.status !== 'loaded') return

    // In sequence rather than at once: this is cleanup nobody is waiting on, and
    // one shared IndexedDB transaction queue gains nothing from twenty parallel
    // deletes.
    for (const anlage of gefunden.anlagen) {
      await anlagen.removeAnlage(anlage.id)
    }
  } catch {
    // Nothing to say and nothing to do. The protocol itself is gone.
  }
}
