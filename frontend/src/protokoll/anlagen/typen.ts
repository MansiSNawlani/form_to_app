/* What hangs off a protocol besides its answers: the map excerpt showing where
 * the stretch is, and the photographs of it.
 *
 * Load-bearing, and now literally the backend's AnlageAntwort. Feature 10 shaped
 * this against the Attachment model for exactly this moment, and feature 3d
 * finished the job: the field names are the server's own, so a record travels
 * from the API into a component without being reshaped anywhere on the way.
 * `entwurf/typen.ts` does the same with form_version and created_at, and for the
 * same reason: a translation layer is a place for two spellings of one field to
 * drift apart.
 *
 * The bytes are not here. They stay on the server and a preview asks for them by
 * URL, which is what `api.ts` explains at anlagenDateiUrl.
 */

/** The two kinds the legacy form has, and the values Attachment.art stores. */
export type Anlagenart = 'KARTENAUSSCHNITT' | 'FOTO'

/** One attachment, without its bytes. */
export interface Anlage {
  id: string
  /** The protocol it hangs off. Part of every address that reaches it. */
  submission_id: string
  art: Anlagenart
  /** Exactly as the surveyor picked it. Data, never a path. */
  dateiname: string
  /** What the bytes proved to be, not what the upload claimed. */
  mime_type: string
  /** Bytes, as the server counted them while reading. */
  groesse: number
  /** ISO, from the server, so every client agrees on when it was attached. */
  created_at: string
}

/* What a picked file tells us about itself. A structural subset of File, so a
   rule can be tested with a plain object; a real File satisfies it. */
export interface Dateiangaben {
  name: string
  type: string
  size: number
}
