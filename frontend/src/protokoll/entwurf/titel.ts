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
export function protokollTitel(antworten: Antworten): string | null {
  const teile = [
    antworten.probestrecke?.gewaesser?.gewaessername,
    antworten.probestrecke?.ortsangabe,
  ]
    .map((teil) => teil?.trim())
    .filter((teil): teil is string => Boolean(teil))

  return teile.length > 0 ? teile.join(', ') : null
}
