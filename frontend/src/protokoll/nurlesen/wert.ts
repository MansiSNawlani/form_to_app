/* Whether an answer has anything to show, and what.
 *
 * A plain function over a value rather than a branch inside the component, which
 * is what coding-standards.md asks for wherever a wrong answer is available. The
 * wrong answer here is quiet and bad: a count of nought fish printed as "nicht
 * angegeben" tells a reviewer the surveyor skipped the field, when what they
 * actually recorded is that they caught none. Those are different protocols.
 */

/* The text to print for one answer, or nothing at all.
 *
 * Nothing at all means unanswered, and Feldwert prints the placeholder for it.
 * **Unanswered is still drawn**, rather than the field vanishing: the commonest
 * reason a reviewer sends a protocol back is that something was left out, so a
 * view that hides what is missing hides what they are looking for.
 *
 * Trimmed at the ends only. A field somebody typed a space into reads to a
 * person exactly like one they never touched, and the backend's own list query
 * already collapses the two the same way. The inside of the text is left alone,
 * so the line breaks in a Bemerkungen box survive.
 *
 * The check is against the empty string and never against truthiness. "0" is
 * falsy in JavaScript and is a real answer everywhere on this form: a count, a
 * percentage share, a water temperature.
 */
export function angezeigterWert(wert: string | null | undefined): string | null {
  if (wert === null || wert === undefined) return null

  const beschnitten = wert.trim()
  return beschnitten === '' ? null : beschnitten
}
