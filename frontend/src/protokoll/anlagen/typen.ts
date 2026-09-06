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

/* One attachment, without its bytes.
 *
 * The split from the file itself is deliberate and not tidiness. Twenty
 * photographs is up to 200 MB, and a list that carried the bytes would pull all
 * of it into memory to draw a heading. Metadata is also the half that travels to
 * the server in feature 3; the bytes go up separately as a body.
 */
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

/* What a picked file tells us about itself.
 *
 * A structural subset of File rather than File itself, so the rules that read it
 * can be tested with a plain object and stay honest about how little they need.
 * A real File satisfies this.
 */
export interface Dateiangaben {
  name: string
  type: string
  size: number
}
