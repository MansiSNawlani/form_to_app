/* Clearing away the browser database feature 10 kept attachments in.
 *
 * Feature 10 had no server to put a photograph on, so it put them in IndexedDB
 * under `ffs-anlagen`, keyed by a draft id. Feature 3d gave them a server, and
 * 3b had already given drafts server-generated ids, so every row still sitting
 * in that database is keyed by an id that stopped existing and describes a file
 * nothing will ever ask for again.
 *
 * There is nothing to import. There are no real accounts yet, and a photograph
 * attached to a draft that no longer exists cannot be matched to a protocol on
 * the server even in principle. What there is instead is a browser holding
 * potentially hundreds of megabytes of test photographs with nothing pointing at
 * them, and no screen anywhere that would ever mention it. So it is deleted.
 *
 * This is a one-off for the version that introduces it, not a permanent fixture.
 * It is safe to remove once every browser that ran feature 10 has loaded feature
 * 3d, and it costs one call against a database that is not there for everybody
 * else.
 */

const ALTE_DATENBANK = 'ffs-anlagen'

/* Deliberately quiet in every direction.
 *
 * This is housekeeping nobody asked for, so it must never fail a page load,
 * never block one, and never say anything on screen. A browser that refuses
 * IndexedDB, a private window, a second tab holding the old database open: in
 * each of those the right outcome is that nothing happens and the surveyor never
 * learns there was a question.
 */
export function entferneAltenAnlagenspeicher(): void {
  try {
    const anfrage = indexedDB.deleteDatabase(ALTE_DATENBANK)
    /* onblocked fires when another tab still has it open. Nothing to do about
       that: the delete completes when the other tab closes, and if it never
       does, the next load asks again. */
    anfrage.onblocked = () => {}
    anfrage.onerror = () => {}
  } catch {
    /* The property access itself throws in a locked-down profile, before any
       request exists to attach a handler to. */
  }
}
