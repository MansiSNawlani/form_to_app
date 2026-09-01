import type { Antworten } from './typen'

/* What a draft is called, once it is called anything.
 *
 * The mockup heads the page with the Gewaesser and the Ortsangabe, which is how
 * a surveyor recognises their own draft in a list of several. Neither exists on
 * a draft that has just been created, so this returns null rather than inventing
 * a name, and the caller supplies the placeholder. Keeping it here rather than
 * in the header component means the "my submissions" list in feature 3 names a
 * draft the same way without repeating the rule.
 */

/* Takes the two answers rather than the document, so a caller watching just
   those two fields does not have to build a stub envelope to ask. */
export function titelAusTeilen(
  gewaessername: string | undefined,
  ortsangabe: string | undefined,
): string | null {
  const teile = [gewaessername, ortsangabe]
    .map((teil) => teil?.trim())
    .filter((teil): teil is string => Boolean(teil))

  return teile.length > 0 ? teile.join(', ') : null
}

export function protokollTitel(antworten: Antworten): string | null {
  return titelAusTeilen(
    antworten.probestrecke?.gewaesser?.gewaessername,
    antworten.probestrecke?.ortsangabe,
  )
}
