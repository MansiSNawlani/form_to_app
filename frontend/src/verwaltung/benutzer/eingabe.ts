import type { ParseKeys } from 'i18next'
import { z } from 'zod'
import { ROLLEN, type Rolle } from '../../api/typen'
import type { KontoAnlegenAnfrage } from './api'

/* What the new-account form holds, and what counts as filled in.
 *
 * The browser half of the rules, written beside the backend's as
 * coding-standards.md asks. **It is a convenience and never a gate.** Everything
 * here is checked again by app/benutzer/regeln.py, which is what actually decides;
 * this exists so a message appears under the field while somebody types instead of
 * after a round trip.
 *
 * That direction matters when the two could disagree: this half must never refuse
 * something the backend would accept, because the person would be stuck with no
 * way to send a request that would have worked. Where it cannot be sure, it stays
 * quiet and lets the server answer.
 */

/** Feature 16a's rule, from MINDESTLAENGE in backend/app/security/passwoerter.py. */
export const PASSWORT_MINDESTLAENGE = 12

/* An address is checked here only for the shape somebody can see they got wrong.
 *
 * Deliberately not z.email(). Zod's address pattern is ASCII only, so it refuses
 * anna@fischerei-tuebingen.de spelled with its umlaut, which the backend accepts
 * and has a test for: email_validator normalises an international domain rather
 * than rejecting it. A browser rule that refused a valid German address would
 * leave somebody unable to create an account that the server would have made
 * quite happily.
 *
 * So this catches the two mistakes that are unambiguous, a missing @ and a space
 * in the middle, and leaves every finer judgement to the one place that has a real
 * address parser.
 */
function siehtWieEineAdresseAus(wert: string): boolean {
  const teile = wert.split('@')
  return teile.length === 2 && teile.every((teil) => teil.length > 0) && !/\s/.test(wert)
}

export const kontoSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'benutzerverwaltung.anlegen.fehlt.email' satisfies ParseKeys })
    .refine(siehtWieEineAdresseAus, {
      message: 'benutzerverwaltung.anlegen.fehlt.emailForm' satisfies ParseKeys,
    }),

  /* Not trimmed, and not by oversight. A space is a legal character in a password
     and the backend stores what it is given, so trimming here would create an
     account whose password is not the one the administrator typed and read out. */
  passwort: z.string().min(PASSWORT_MINDESTLAENGE, {
    message: 'benutzerverwaltung.anlegen.fehlt.passwort' satisfies ParseKeys,
  }),

  rollen: z
    .array(z.enum(ROLLEN))
    .min(1, { message: 'benutzerverwaltung.anlegen.fehlt.rollen' satisfies ParseKeys }),

  /* The empty string is "nothing chosen", which is what a MUI Select holds before
     anybody touches it. Whether that is allowed depends on the roles, so the rule
     is the coupling in kontoEingabe rather than anything this field can say alone. */
  regierungspraesidium: z.string(),

  locale: z.enum(['de', 'en']),
})

export type Kontoformular = z.infer<typeof kontoSchema>

/* Whether the account is a regional one, which is what decides two things: that
 * the region field is shown at all, and that a number is required.
 *
 * One function rather than the check written inline in the component and again in
 * kontoEingabe below. Two copies of "is this a regional account" is exactly how a
 * screen comes to show a field it then refuses to send.
 */
export function istRegional(rollen: readonly Rolle[]): boolean {
  return rollen.includes('REGIERUNGSPRAESIDIUM')
}

/* The form as the API wants it, and the one place the region coupling is applied.
 *
 * Feature 16a's backend refuses two combinations, and this is their browser half:
 * a regional role with no number, and a number on an account that has no regional
 * role. The first is reported under the field; the second cannot happen, because
 * the number is dropped here rather than sent.
 *
 * **Dropped rather than merely hidden.** Somebody who ticks Regierungspraesidium,
 * picks Freiburg, then changes their mind and unticks it would otherwise send a
 * number the server refuses, for a field they can no longer see. The request is
 * built from what the answers mean together, not from whatever each control was
 * last left holding.
 *
 * Returns null when the form is not sendable, so the caller has one thing to
 * check. What is missing is said under the field by fehltDieRegion below; this
 * only answers whether there is a request to make.
 */
export function kontoEingabe(formular: Kontoformular): KontoAnlegenAnfrage | null {
  if (fehltDieRegion(formular.rollen, formular.regierungspraesidium)) return null

  return {
    email: formular.email,
    passwort: formular.passwort,
    rollen: [...formular.rollen],
    regierungspraesidium: istRegional(formular.rollen)
      ? Number(formular.regierungspraesidium)
      : null,
    locale: formular.locale,
  }
}

/* Whether to say the number is missing, which is the one case above.
 *
 * Takes the two values rather than the whole form, so the page can call it with
 * what it is already watching and neither side restates the rule. A second copy of
 * "a regional account needs a number" is how a screen comes to refuse a form it
 * would have sent, or send one it should have refused.
 */
export function fehltDieRegion(rollen: readonly Rolle[], regierungspraesidium: string): boolean {
  return istRegional(rollen) && regierungspraesidium === ''
}

/* What the form starts as.
 *
 * Every field is present from the first render. React treats an input that gains
 * a value later as switching from uncontrolled to controlled and says so in the
 * console, and a checkbox group with no array behind it cannot be toggled at all.
 */
export const LEERES_FORMULAR: Kontoformular = {
  email: '',
  passwort: '',
  rollen: [],
  regierungspraesidium: '',
  locale: 'de',
}
