/* Where to go after signing in.
 *
 * Somebody who follows a link to a protocol while signed out should land on that
 * protocol, not on the home page, so the guard puts the page they asked for into
 * the address as ?weiter=... and the login page reads it back.
 *
 * That value comes out of the address bar, which makes it untrusted input no
 * matter who sent the link. Without the check below, a link reading
 * /anmeldung?weiter=https://example.com would turn our own login page into a
 * redirect to somebody else's site, arriving from our domain and therefore
 * looking like us. That is the standard shape of a phishing link, and it is why
 * this is a rule with a test rather than two lines inside a component.
 */

/** The query parameter name. A link can carry it, so it is a fixed contract. */
export const WEITER_PARAM = 'weiter'

/** The login page's own path, which is the one route outside the guard. */
export const ANMELDUNG_PFAD = '/anmeldung'

/* Why somebody is looking at the login page, when there is a reason worth
 * saying. Being bounced out of a half-filled protocol with no explanation reads
 * as the application having lost your work, and it has not.
 *
 * One value, and anything else is ignored rather than shown. The parameter is in
 * the address bar, so a stranger can put whatever they like in it; mapping it to
 * a fixed message means the worst they can do is make our own sentence appear.
 */
export const GRUND_PARAM = 'grund'
const ABGELAUFEN = 'abgelaufen'

export function istAbgelaufen(roh: string | null | undefined): boolean {
  return roh === ABGELAUFEN
}

const STARTSEITE = '/'

/* An address on this site, or the home page.
 *
 * Anything not recognisably one of ours becomes the home page rather than an
 * error: a bad value in a link is nothing the person can act on, and dropping
 * them on their own submissions list is a sane place to be.
 */
export function sichererWeiterPfad(roh: string | null | undefined): string {
  if (!roh) return STARTSEITE

  // Must be a path on this site. An absolute URL, with or without a scheme,
  // starts with something else and is refused here.
  if (!roh.startsWith('/')) return STARTSEITE

  /* //example.com is protocol-relative: the browser reads it as another host,
     not as a path. So does /\example.com and /\/example.com, because a backslash
     is normalised to a forward slash in a URL. Both look like paths and are not. */
  if (roh.startsWith('//') || roh.startsWith('/\\')) return STARTSEITE

  return roh
}

/* Where to send somebody who is not signed in.
 *
 * The page they asked for travels with them so they arrive at it rather than at
 * the home page, which matters most for the case somebody was sent a link to one
 * particular protocol.
 *
 * The path is put through the same check on the way out as on the way back. It
 * comes from the router rather than from a stranger, so this is belt and braces,
 * but the alternative is a rule that holds only as long as every future caller
 * remembers where its argument came from.
 *
 * Nothing is carried for the home page: it is where a signed-in visitor lands
 * anyway, and /anmeldung reads better than /anmeldung?weiter=%2F on the address
 * bar of the most ordinary arrival there is. The reason, when there is one, is
 * carried either way, because it is worth saying even to somebody who was on the
 * home page when their session ran out.
 */
export function anmeldungsZiel(pfad: string, abgelaufen = false): string {
  const ziel = sichererWeiterPfad(pfad)
  const teile = new URLSearchParams()

  if (ziel !== STARTSEITE) teile.set(WEITER_PARAM, ziel)
  if (abgelaufen) teile.set(GRUND_PARAM, ABGELAUFEN)

  const abfrage = teile.toString()
  return abfrage === '' ? ANMELDUNG_PFAD : `${ANMELDUNG_PFAD}?${abfrage}`
}
