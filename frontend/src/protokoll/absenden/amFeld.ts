/* What a refused answer looks like at the field itself, rather than in the list.
 *
 * FFS asked on 2026-10-15 for the field the server objected to to stand out:
 * the list says what is wrong, the red border says where. Kept pure, and shared
 * with the list and the step bar, so all three agree on what a message says and
 * on when a problem counts as dealt with.
 */

import type { ParseKeys } from 'i18next'

/* Filled in, not correct. The browser can see a box is no longer empty; whether
 * the value is right is the server's to say, because the rules live there.
 */
export function istAusgefuellt(wert: unknown): boolean {
  return typeof wert === 'string' && wert.trim() !== ''
}

/* The browser's own message wins: it is about the answer as it stands now,
 * while the server's is about the answer as it stood at the last submit. The
 * server's stays only while the box is still empty, so somebody filling it in
 * sees the red go at once instead of after the next Absenden.
 */
export function feldMeldung<K extends string>(
  browser: K | undefined,
  server: K | undefined,
  wert: unknown,
): K | undefined {
  if (browser !== undefined) return browser
  if (server !== undefined && !istAusgefuellt(wert)) return server
  return undefined
}

/* The key arrives from the server as a plain string, so it is checked before it
 * is translated. A backend deployed ahead of the browser can name a rule this
 * locale file has never heard of, and printing the raw key at a surveyor is
 * exactly what feature 11a's step 10 test exists to prevent.
 */
export function bekannteMeldung(
  schluessel: string,
  gibtEs: (schluessel: string) => boolean,
): ParseKeys {
  return gibtEs(schluessel)
    ? (schluessel as ParseKeys)
    : 'protokoll.absenden.probleme.unbekannteRegel'
}
