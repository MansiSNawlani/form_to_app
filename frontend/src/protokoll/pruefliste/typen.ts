/* What GET /api/v1/pruefliste sends back.
 *
 * Load-bearing. Mirrors PruefzeileAntwort and PrueflisteAntwort in
 * backend/app/api/schemas.py field for field and in the same names, snake_case
 * included, for the reason api/typen.ts already gives: renaming on the way in
 * would need a mapping layer, and a mapping layer is one more place for the two
 * halves to disagree.
 *
 * **Deliberately not Uebersicht.** That is Meine Protokolle's shape, and it reads
 * its display values out of the answers document because a draft has no envelope
 * behind it. Nothing in this queue is a draft, so every value here comes from a
 * real column: the water is joined from Gewaesser, the place from Probestrecke.
 * Widening one shape to serve both screens would put nullable fields on a list
 * that never needs them and tie two screens together.
 */

import type { Status } from '../entwurf/typen'

/** One protocol as the review queue shows it, without its answers. */
export interface Pruefzeile {
  id: string
  /** Never DRAFT. The queue lists work that has been handed in. */
  status: Status
  form_version: string

  /** The day of the Befischung, not the day it was filed. */
  datum: string
  /** The code, not the label. optionen.ts turns it into words. */
  anlass: string
  /** Frozen at submit, so a later change to the Person record cannot rewrite it. */
  bearbeiter_name: string
  submitted_at: string
  updated_at: string

  /** The e-mail address of the account that filed it. */
  eingereicht_von: string

  /** As the surveyor typed it, never normalised. */
  gewaessername: string
  ortsangabe: string
  /* A number here, where Uebersicht carries a string: this comes from a typed
     column and that one comes from the answers document. */
  laenge_m: number
  /** Null for most stretches. Only WRRL and FFH monitoring sites carry one. */
  monitoringstrecke_nr: string | null
  /** 1 to 4. Feature 13 reads it; this screen does not print it. */
  regierungspraesidium: number
}

/** One page of the queue, and enough to draw a pager around it. */
export interface Prueflistenseite {
  zeilen: Pruefzeile[]
  /** Every protocol matching the filters, not only the ones on this page. */
  gesamt: number
  seite: number
  pro_seite: number
  /** Never below 1, so an empty queue reads "Seite 1 von 1". */
  seiten: number
}
