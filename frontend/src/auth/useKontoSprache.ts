/* The interface follows the signed-in account's language.
 *
 * src/i18n/index.ts has been promising this since feature 1b, where the choice
 * was parked in localStorage so it could be exercised from devtools before any
 * account existed. The account is now the authority, and localStorage keeps the
 * answer only so the very first paint after a reload is in the right language,
 * before /ich has answered.
 *
 * The account wins at sign-in, over whatever was picked on the login page. A
 * choice made once signed in is saved to the account by SprachUmschalter, which
 * also updates the session, so this sees nothing to correct.
 */

import { useEffect } from 'react'
import i18n, { setLocale } from '../i18n'
import type { Locale } from '../i18n'

export function useKontoSprache(locale: Locale | undefined) {
  useEffect(() => {
    // Compared before setting, because setLocale writes to localStorage and
    // tells i18next, and neither needs doing on every render.
    if (locale !== undefined && locale !== i18n.language) setLocale(locale)
  }, [locale])
}
