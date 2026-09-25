/* What a row of the account list prints, worked out without a browser.
 *
 * Plain functions over values, the arrangement coding-standards.md asks for
 * wherever a wrong answer is possible. Nothing here translates: a function that
 * reached for i18next could not be tested without initialising it, so anything
 * needing a word returns a key and the component looks it up. That is the shape
 * liste/anzeige.ts uses and this follows it.
 *
 * The creation date is not here. zeitpunktAnzeige in liste/anzeige.ts already
 * prints a stored moment, and a second way to print one is a second way for two
 * screens to disagree about the same instant.
 */

import { optionLabel } from '../../protokoll/optionen'

/* The name of a Regierungspraesidium, out of the extracted option list.
 *
 * The number rather than the name is what the account row stores, because that is
 * what the legacy form exports and what FiaKa receives. The list is where the
 * wording lives, and it is read rather than retyped, exactly as
 * pruefung/Uebersichtsleiste.tsx already does for a protocol's own region: two
 * hand-written copies of "which number is Karlsruhe" is the drift worth avoiding.
 *
 * null for an account with no region, which is most of them, and the cell is then
 * blank rather than showing a dash that would read as a value.
 */
export function regierungspraesidiumLabel(nummer: number | null): string | null {
  return nummer === null ? null : optionLabel('z.rp', String(nummer))
}

/* The two literal keys rather than string, so a key renamed in de.json is a build
   error here instead of a raw key printed into a table cell. */
export type Kontostatusschluessel =
  | 'benutzerverwaltung.status.aktiv'
  | 'benutzerverwaltung.status.gesperrt'

/* Whether the account can be signed in to.
 *
 * Two states and no more: an account is never deleted here, only locked, because
 * a deleted account takes the owner of every protocol it filed with it.
 * app/benutzer/dienst.py has said so since feature 2a.
 */
export function kontostatusSchluessel(istAktiv: boolean): Kontostatusschluessel {
  return istAktiv ? 'benutzerverwaltung.status.aktiv' : 'benutzerverwaltung.status.gesperrt'
}
