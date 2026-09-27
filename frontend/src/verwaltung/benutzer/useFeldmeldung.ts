import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'

/* Turns one of the schema's messages into German.
 *
 * eingabe.ts and aendern.ts put translation keys in their Zod messages rather than
 * sentences, so both stay plain modules with no i18n in them and can be tested
 * without initialising one. Something has to look the key up, and all three
 * account forms were doing it with the same three lines.
 *
 * The cast is the part worth having in one place. react-hook-form types a field
 * error's message as a plain string, because for most projects it is one; here it
 * is always a key, and asserting that in three files is three chances for the
 * fourth form to assert something subtly different.
 */
export function useFeldmeldung() {
  const { t } = useTranslation()

  return (schluessel?: string) => (schluessel ? t(schluessel as ParseKeys) : undefined)
}
