/* What may be attached to a protocol, and what to say when something may not.
 *
 * A plain function from a picked file to what is wrong with it, holding no
 * React and no German, exactly like regeln/regel.ts. It returns a translation
 * key rather than a sentence so feature 17 can translate it, and the values the
 * sentence needs so the message can name the file and the numbers.
 *
 * Every refusal here has to name the file, say why in ordinary words, and say
 * what to do instead. The reasons are therefore kept apart rather than folded
 * into one "not allowed": a HEIC photograph and a file that is too large have
 * nothing in common except that neither went in, and the useful half of each
 * message is the way out, which differs completely.
 */

import type { ParseKeys } from 'i18next'
import type { Anlagenart, Dateiangaben } from './typen'

/* What a browser can put in an <img> without help, with the name a person
   would use for each. One list rather than two, so the accepted types and the
   types the messages name can never drift apart. */
const FORMATE = [
  { typ: 'image/jpeg', label: 'JPG' },
  { typ: 'image/png', label: 'PNG' },
  { typ: 'image/webp', label: 'WEBP' },
] as const

export const ERLAUBTE_TYPEN: string[] = FORMATE.map((format) => format.typ)
export const ERLAUBTE_FORMATE: string[] = FORMATE.map((format) => format.label)

/* A phone photograph is 2 to 8 MB, so this leaves room without letting a single
   file eat the protocol's whole allowance. */
export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_MB = MAX_BYTES / 1024 / 1024

/* Not the legacy form's four. Four is how many image buttons fitted on the
   printed page, not a statement about how many photographs a survey may have;
   decided on 2026-09-06. Twenty is a safety valve against a browser running out
   of room, not a judgement about the survey. */
export const MAX_FOTOS = 20
const MAX_KARTENAUSSCHNITTE = 1

export type Anlagengrund = 'anzahl' | 'heic' | 'typ' | 'groesse'

export interface Anlagenverstoss {
  grund: Anlagengrund
  schluessel: ParseKeys
  /** What the message interpolates. Always carries the file's own name. */
  werte: Record<string, number | string>
}

/* HEIC is the format every iPhone saves photographs in and no browser can
 * display it in an <img>. Picking a photo through a file input on the phone
 * itself hands over a JPEG, so the common path never reaches this; what does is
 * a HEIC file copied off a phone onto a desktop first.
 *
 * Matched on the extension as well as the media type because a browser that has
 * never heard of the format reports an empty type rather than an unknown one,
 * leaving the name as the only evidence.
 */
const HEIC_TYPEN = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']

function istHeic({ name, type }: Dateiangaben): boolean {
  return HEIC_TYPEN.includes(type.toLowerCase()) || /\.hei[cf]$/i.test(name)
}

function maximum(art: Anlagenart): number {
  return art === 'FOTO' ? MAX_FOTOS : MAX_KARTENAUSSCHNITTE
}

/** Whole megabytes to one decimal. Nobody can act on a byte count. */
function alsMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

/* One file at a time, and how many of its kind are already there, rather than a
 * whole batch. The Fotos block picks several at once and feeds them through in
 * turn, raising its own count as each is accepted, so a pick of five against
 * eighteen stores two and reports three by name. Deciding that ordering in here
 * would make the rule harder to test for no gain.
 */
export function pruefeAnlage(
  datei: Dateiangaben,
  art: Anlagenart,
  vorhanden: number,
): Anlagenverstoss | null {
  const werte = { dateiname: datei.name }

  /* Before anything about the file itself: no amount of converting or shrinking
     it will make room, so saying the slot is full is the only useful answer. */
  if (vorhanden >= maximum(art)) {
    return art === 'FOTO'
      ? {
          grund: 'anzahl',
          schluessel: 'protokoll.anlagen.fehler.fotosVoll',
          werte: { ...werte, vorhanden, max: MAX_FOTOS },
        }
      : {
          /* Not reachable from the section as it stands, because its single
             slot replaces rather than adds. Kept because this function is the
             cap, not the screen: feature 3 mirrors it in Pydantic, where a
             second excerpt very much can arrive. */
          grund: 'anzahl',
          schluessel: 'protokoll.anlagen.fehler.kartenausschnittBelegt',
          werte,
        }
  }

  /* Before the size check, and deliberately. A HEIC photograph is often over
     the cap as well, and converting it is what has to happen first; the JPG
     that comes out is usually small enough anyway. */
  if (istHeic(datei)) {
    return { grund: 'heic', schluessel: 'protokoll.anlagen.fehler.heic', werte }
  }

  if (!ERLAUBTE_TYPEN.includes(datei.type.toLowerCase())) {
    return { grund: 'typ', schluessel: 'protokoll.anlagen.fehler.typ', werte }
  }

  if (datei.size > MAX_BYTES) {
    return {
      grund: 'groesse',
      schluessel: 'protokoll.anlagen.fehler.groesse',
      werte: { ...werte, groesseMb: alsMb(datei.size), maxMb: alsMb(MAX_BYTES) },
    }
  }

  return null
}
