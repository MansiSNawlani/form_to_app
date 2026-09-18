/* What a row of the review queue prints, worked out without a browser.
 *
 * Plain functions over values, the arrangement coding-standards.md asks for
 * wherever a wrong answer is possible. Nothing here translates: a function that
 * reached for i18next could not be tested without initialising it, so anything
 * needing a word takes it as an argument, which is the same shape
 * liste/anzeige.ts uses.
 *
 * The dates, the status badge and the Anlass label are not here. Those are
 * liste/anzeige.ts's and Statusabzeichen's, imported rather than rewritten: a
 * second way to print a status or a date is a second way for two screens a
 * reviewer moves between to disagree about the same protocol.
 */

/* Metres. The same symbol in both locales and on the printed form, so it is not
   a translated string. */
const EINHEIT = 'm'

const TRENNER = ' · '

function gefuellt(wert: string | null): string | null {
  const sauber = wert?.trim()
  return sauber ? sauber : null
}

/* The row's second line: where on the water, how much of it, and the monitoring
 * number when the stretch has one.
 *
 * "Weissenau, oberhalb der Bruecke · 120 m · MST 12345". The separator only
 * appears between two things that are both there, so a stretch with no
 * monitoring number does not print a trailing dot, which would read as a value
 * that failed to load.
 *
 * Deliberately not liste/anzeige.ts's unterzeile, which this screen would
 * otherwise share. That one takes two strings read out of the answers document,
 * because a draft has no envelope; this takes a typed integer length and a third
 * part that only exists on WRRL and FFH sites. Widening Meine Protokolle's
 * function to carry a column its own list never has would be the wrong direction.
 *
 * monitoring arrives already worded ("MST 12345"), because the prefix is a label
 * and this file has no i18next in it.
 */
export function unterzeile(
  ortsangabe: string,
  laengeM: number | null,
  monitoring: string | null,
): string | null {
  const teile = [
    gefuellt(ortsangabe),
    laengeM === null ? null : `${laengeM} ${EINHEIT}`,
    gefuellt(monitoring),
  ].filter((teil): teil is string => teil !== null)

  return teile.length > 0 ? teile.join(TRENNER) : null
}
