/* The four calls a protocol's attachments need.
 *
 * Feature 10 built the section against `anlagen/store.ts`, which kept the files
 * in the browser's own IndexedDB because there was no login and no server-side
 * draft yet. Feature 3d replaces that store with this module, which is exactly
 * what 3b did to `entwurf/store.ts`: the file is not renamed and gutted, it is
 * replaced, because "store" is the wrong word for something that keeps nothing.
 *
 * A photograph now belongs to an account rather than to a browser, so it
 * survives a different machine, cleared site data, and eventually reaches FFS.
 *
 * Thin on purpose. Every one of these is a path, a method and a type: the
 * cookie, the body encoding and turning a refusal into a typed error are all
 * `api/client.ts`'s job, and deciding what to do about a failure is the caller's.
 *
 * fetchImpl travels through so the tests need no browser and no stubbed global,
 * the same arrangement `entwurf/api.ts` uses.
 */

import { apiAnfrage } from '../../api/client'
import type { Anlage, Anlagenart } from './typen'

interface MitFetch {
  fetchImpl?: typeof fetch
}

/* Nested under the protocol, because that is how the backend addresses them and
 * because ownership is decided by the protocol rather than by the attachment.
 * An attachment id on its own is not an address: the backend refuses one that
 * belongs to a different protocol, so nothing here may drop the id it is under. */
function pfad(entwurfId: string): string {
  return `/protokolle/${encodeURIComponent(entwurfId)}/anlagen`
}

/* Where a picture is fetched from, as a URL rather than as bytes.
 *
 * The one call that is not a call. An <img> asks for this address itself, with
 * the session cookie riding along because it is same-origin, so nothing here
 * downloads a file to hand to a component. That retires the object URL feature
 * 10 called its sharpest edge: an unrevoked one holds its whole file in memory
 * for as long as the tab is open, and this tab stays open all day.
 *
 * Absolute from the site root rather than through apiAnfrage, because the
 * browser resolves it, not us.
 */
export function anlagenDateiUrl(entwurfId: string, anlageId: string): string {
  return `/api/v1${pfad(entwurfId)}/${encodeURIComponent(anlageId)}/datei`
}

/* This protocol's attachments, oldest first, without their bytes.
 *
 * Both kinds in one list. The blocks each filter for their own, which is one
 * request for a screen that shows both rather than two that race.
 */
export function listeAnlagen(
  entwurfId: string,
  { fetchImpl }: MitFetch = {},
): Promise<Anlage[]> {
  return apiAnfrage<Anlage[]>(pfad(entwurfId), { fetchImpl })
}

interface HochladenAnfrage extends MitFetch {
  entwurfId: string
  art: Anlagenart
  datei: File
}

/* Attach one file.
 *
 * One per request, not a batch, even though the Fotos picker takes several at
 * once. `regeln.ts` settled that in feature 10: files go through in turn so a
 * pick of five against eighteen stores two and names the three that did not fit.
 *
 * multipart/form-data, which is the one case where the browser must set
 * Content-Type itself: the boundary in the header has to match the one it
 * invented for the body. api/client.ts leaves a FormData alone for that reason.
 *
 * The browser has already applied `pruefeAnlage` before this is called, and the
 * backend applies its own half again. That is not duplication for its own sake:
 * the browser's is instant feedback and the server's is the gate, which is what
 * coding-standards.md means by writing every rule twice.
 */
export function ladeAnlageHoch({
  entwurfId,
  art,
  datei,
  fetchImpl,
}: HochladenAnfrage): Promise<Anlage> {
  const koerper = new FormData()
  koerper.append('art', art)
  /* The filename is sent as the third argument rather than left to the File,
     so it is the name the surveyor picked. The backend stores it as data and
     never as a path, which is what keeps a name like "../../boom.jpg" harmless. */
  koerper.append('datei', datei, datei.name)

  return apiAnfrage<Anlage>(pfad(entwurfId), { methode: 'POST', koerper, fetchImpl })
}

/* Remove one attachment, and the file behind it.
 *
 * Nothing comes back and nothing is undone. Asking first is the screen's job,
 * which feature 10 already built as a dialog, so there is no confirmation flag
 * here for a caller to forget.
 */
export function loescheAnlage(
  entwurfId: string,
  anlageId: string,
  { fetchImpl }: MitFetch = {},
): Promise<void> {
  return apiAnfrage<void>(`${pfad(entwurfId)}/${encodeURIComponent(anlageId)}`, {
    methode: 'DELETE',
    fetchImpl,
  })
}
