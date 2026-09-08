/* A failure as a finished German sentence.
 *
 * fehlertext deliberately returns a key or a sentence rather than text, so that
 * it stays a plain function with no i18n in it and can be tested without one.
 * That leaves every component doing the same two-line translation dance, and by
 * the second one they had already drifted apart in whitespace. This is that
 * dance, written once.
 */

import { useTranslation } from 'react-i18next'
import { fehlertext } from './fehler'

/** undefined when nothing went wrong, so a caller can render it or not. */
export function useFehlertext(fehler: unknown): string | undefined {
  const { t } = useTranslation()
  if (fehler === null || fehler === undefined) return undefined

  const text = fehlertext(fehler)
  return text.art === 'schluessel' ? t(text.schluessel) : text.text
}
