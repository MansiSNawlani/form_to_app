/* What hangs off a protocol besides its answers: the map excerpt showing where
 * the stretch is, and the photographs of it.
 *
 * Load-bearing. This mirrors the Attachment model in project-overview.md field
 * for field, so feature 3 sends the record straight to the server rather than
 * reshaping it on the way. The one deliberate difference is that Attachment has
 * a storage_key naming a file on a server, and there is no server yet, so here
 * the bytes sit beside the record in the browser's own database instead.
 */

/** The two kinds the legacy form has, and the values Attachment.art stores. */
export type Anlagenart = 'KARTENAUSSCHNITT' | 'FOTO'

/** One attachment, without its bytes. store.ts says why the two are apart. */
export interface Anlage {
  id: string
  /** Becomes submission_id once feature 3 gives a draft a server identity. */
  entwurfId: string
  art: Anlagenart
  dateiname: string
  mimeType: string
  /** Bytes, as the browser reported them. */
  groesse: number
  /** ISO. Becomes created_at. */
  angelegtAm: string
}

/* What a picked file tells us about itself. A structural subset of File, so a
   rule can be tested with a plain object; a real File satisfies it. */
export interface Dateiangaben {
  name: string
  type: string
  size: number
}
