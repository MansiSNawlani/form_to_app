import { useTranslation } from 'react-i18next'
import { localeFuer, type Locale } from './sprachen'

/* The active locale, for code that needs the language itself rather than a
 * text: the dropdown entries in protokoll/optionen.ts take it as an argument.
 *
 * Read through useTranslation so the component renders again when the language
 * is switched, which reading i18n.language directly would not do. */
export function useLocale(): Locale {
  const { i18n } = useTranslation()
  return localeFuer(i18n.language)
}
