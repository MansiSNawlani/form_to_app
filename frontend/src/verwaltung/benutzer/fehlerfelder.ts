import { ApiFehler } from '../../api/fehler'

/* Which field a refusal from the server belongs under.
 *
 * The standing rule on this project is that a problem is shown next to the thing
 * it concerns rather than stacked in a list at the top of the page, and this is
 * the part of that rule the server's answers need: the API replies with one code
 * and one sentence, and only this mapping knows which control the sentence is
 * about.
 *
 * A plain function over a code, so it can be held to its promise without a
 * browser, which is what coding-standards.md asks wherever a wrong answer is
 * possible. Two wrong answers are available and both are bad: a message about the
 * address appearing under the password, and a message with no field at all
 * vanishing silently.
 *
 * **The codes are published contracts**, listed in feature 16a's spec, not names
 * a refactor may change. 16d branches on the same set.
 */

/** The fields of the new-account form a server refusal can be about. */
export type Fehlerfeld = 'email' | 'passwort' | 'rollen' | 'regierungspraesidium'

const FELD_JE_CODE: Record<string, Fehlerfeld> = {
  EMAIL_UNGUELTIG: 'email',
  EMAIL_VERGEBEN: 'email',
  ROLLEN_LEER: 'rollen',
  PASSWORT_ZU_KURZ: 'passwort',
  PASSWORT_ZU_LANG: 'passwort',
  REGIERUNGSPRAESIDIUM_FEHLT: 'regierungspraesidium',
  REGIERUNGSPRAESIDIUM_UNZULAESSIG: 'regierungspraesidium',
  REGIERUNGSPRAESIDIUM_UNBEKANNT: 'regierungspraesidium',
}

/* REGIERUNGSPRAESIDIUM_UNZULAESSIG is in that table although this form cannot
 * produce it: kontoEingabe drops a number whose role is not ticked, so the server
 * never sees one it would refuse. It is mapped anyway, because a refusal this
 * screen cannot cause today is one a later change could, and an unmapped code
 * falls through to the general message beside the button, where it would be a
 * sentence about a field nobody is looking at.
 */

/** undefined when the refusal is not about one field, which the caller shows whole. */
export function feldFuerFehler(fehler: unknown): Fehlerfeld | undefined {
  if (!(fehler instanceof ApiFehler)) return undefined
  return FELD_JE_CODE[fehler.code]
}
