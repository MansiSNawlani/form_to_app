import { z } from 'zod'
import { ROLLEN, type BenutzerAntwort, type Rolle } from '../../api/typen'
import { sortierteRollen } from '../../auth/rollen'
import type { KontoAendernAnfrage } from './api'
import { fehltDieRegion, istRegional, kontoSchema } from './eingabe'

/* What the edit form holds, and what a change to an account actually is.
 *
 * The browser half of feature 16a's rules, written beside the backend's as
 * coding-standards.md asks. **It is a convenience and never a gate**: everything
 * here is checked again by app/benutzer/regeln.py, which is what decides. This
 * exists so a message appears under a field while somebody types rather than
 * after a round trip, and so that the request says exactly what was meant.
 */

/* The create form's schema with the password taken out, rather than a second
 * list of the same four fields.
 *
 * The rules are the same rules: an address is an address, an account needs a
 * role, and the region is a string because that is what a MUI Select holds. Two
 * copies would be two chances for the two screens to disagree about what a valid
 * address is, and the one that drifted would be the one nobody was looking at.
 *
 * The password is absent rather than optional. It is not a field of this form at
 * all: it goes through its own endpoint, on its own card, for the reason 16a
 * separated them, which is that it must never travel beside values that get
 * echoed back in a validation error.
 */
export const kontoAendernSchema = kontoSchema.omit({ passwort: true })

export type Kontoaenderungsformular = z.infer<typeof kontoAendernSchema>

/* The account as the form holds it.
 *
 * The region becomes a string because that is what the Select reads and writes,
 * and an account with no region becomes the empty string, which is that control's
 * "nothing chosen".
 *
 * The roles come back in ROLLEN order rather than the server's, which is not
 * promised to be stable between two reads of the same row. Without it, loading
 * the same account twice could produce two different orders and the second would
 * look like an edit.
 */
export function formularAusKonto(konto: BenutzerAntwort): Kontoaenderungsformular {
  return {
    email: konto.email,
    rollen: sortierteRollen(konto.rollen),
    regierungspraesidium:
      konto.regierungspraesidium === null ? '' : String(konto.regierungspraesidium),
    locale: konto.locale,
  }
}

/* A role the account holds that this build has no checkbox for.
 *
 * Only reachable against a newer backend, which is exactly when a screen should
 * degrade quietly rather than destructively. sortierteRollen already drops these
 * from what is printed, and the form cannot show them either, so without this the
 * first save from an older bundle would take the new role off the account and
 * nobody would see it go.
 */
function unbekannteRollen(konto: BenutzerAntwort): Rolle[] {
  const bekannt: readonly string[] = ROLLEN
  return konto.rollen.filter((rolle) => !bekannt.includes(rolle))
}

function gleicheRollen(eine: readonly Rolle[], andere: readonly Rolle[]): boolean {
  return eine.length === andere.length && eine.every((rolle) => andere.includes(rolle))
}

/* What pressing "Speichern" should do.
 *
 * Three answers rather than a request or null, because the caller has three
 * different things to say: send this, there is nothing to send, and this form is
 * not finished. Folding the last two together would mean a form missing its
 * region reported "nothing changed", which is both untrue and the opposite of
 * helpful.
 */
export type Aenderung =
  | { art: 'unvollstaendig' }
  | { art: 'unveraendert' }
  | { art: 'aenderung'; anfrage: KontoAendernAnfrage }

/* The smallest request that expresses what changed.
 *
 * **A field nobody touched is not in the body at all.** That is what feature 16a
 * built the partial update for: an account has no version column and there is no
 * refusal for a stale edit, so sending the whole form every time would mean two
 * administrators editing different fields silently overwrote each other. Sending
 * only what changed narrows that to the same field being edited twice at once.
 *
 * **Taking the regional role away clears the number in the same request.** The one
 * piece of this that is not bookkeeping. aendere_benutzer refuses a leftover
 * number rather than tidying it up, and the comment in dienst.py says why:
 * dropping it quietly would be the service deciding what somebody meant, and the
 * number is the field that scopes what a regional account can see. So the number
 * is cleared here, where somebody asked for it, and null is the instruction that
 * says so.
 *
 * ist_aktiv never appears. Locking is the Zugang card's, and it builds its own
 * request from the account rather than from this form, so that somebody who types
 * an address, thinks better of it and then locks the account does not save the
 * address as well.
 */
export function kontoAenderung(
  konto: BenutzerAntwort,
  formular: Kontoaenderungsformular,
): Aenderung {
  if (fehltDieRegion(formular.rollen, formular.regierungspraesidium)) {
    return { art: 'unvollstaendig' }
  }

  const anfrage: KontoAendernAnfrage = {}

  const email = formular.email.trim()
  if (email !== konto.email) anfrage.email = email

  const rollen = [...formular.rollen, ...unbekannteRollen(konto)]
  if (!gleicheRollen(rollen, konto.rollen)) anfrage.rollen = rollen

  const regierungspraesidium = istRegional(formular.rollen)
    ? Number(formular.regierungspraesidium)
    : null
  if (regierungspraesidium !== konto.regierungspraesidium) {
    anfrage.regierungspraesidium = regierungspraesidium
  }

  if (formular.locale !== konto.locale) anfrage.locale = formular.locale

  return Object.keys(anfrage).length === 0
    ? { art: 'unveraendert' }
    : { art: 'aenderung', anfrage }
}

/* Whether this change would take your own SUPER_ADMIN away.
 *
 * Feature 16a's second safety rule, mirrored: a Super Admin may not lock their own
 * account and may not take SUPER_ADMIN off it, even with three other Super Admins
 * about. Both sign the person out of the screen they are standing on with no way
 * back except asking somebody else.
 *
 * Said before the button is pressed rather than only after the server refuses,
 * because a refusal you could have been told about beforehand is a wasted round
 * trip and a worse explanation. The server is still the gate; this only saves the
 * trip.
 *
 * **The "last active Super Admin" rule is deliberately not mirrored.** The browser
 * would have to count active Super Admins out of a cached list, which is a second
 * opinion built on stale data. 16a measured that over HTTP that rule can only ever
 * fire on the caller's own account anyway, since reaching the route at all proves
 * one active Super Admin exists, so its sentence from the server is what says it.
 *
 * False while eigeneId is still unknown. For that one render nothing is treated
 * as your own account, rather than the wrong thing being treated as it.
 */
export function entziehtSichSuperAdmin(
  konto: BenutzerAntwort,
  eigeneId: string | null,
  neueRollen: readonly Rolle[],
): boolean {
  if (eigeneId === null || konto.id !== eigeneId) return false

  return konto.rollen.includes('SUPER_ADMIN') && !neueRollen.includes('SUPER_ADMIN')
}

/* Whether locking this account is something the screen may offer at all.
 *
 * The same rule read the other way round, and the reason the Zugang card draws a
 * sentence instead of a button: an action that can only ever fail is worse than no
 * action, because it invites somebody to try and then explains why they should not
 * have.
 */
export function darfSperren(konto: BenutzerAntwort, eigeneId: string | null): boolean {
  return eigeneId === null || konto.id !== eigeneId
}
