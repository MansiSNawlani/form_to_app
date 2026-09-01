import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'
import { BW_GRENZEN } from '../protokoll/regeln/koordinaten'

/* The single place the active locale is decided.
 *
 * German is both the source locale and the fallback, never English. The domain
 * is German, the legacy form is German, and a missing key should degrade to the
 * language the content was written in rather than to a half-built translation.
 *
 * Feature 2 points this at the signed-in account's User.locale field. Until then
 * the choice lives in localStorage, so it can be exercised from devtools without
 * a language switcher existing yet.
 *
 * en.json is a deliberate stub holding two keys. It is not a translation effort;
 * feature 17 fills it. It exists so the fallback path is exercised rather than
 * assumed: every key it does not define must render German.
 */

export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const FALLBACK_LOCALE: Locale = 'de'
const STORAGE_KEY = 'ffs-locale'

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Private browsing and blocked site data both throw here. German is correct
    // either way, so there is nothing to recover from.
  }
  return FALLBACK_LOCALE
}

/* Keeps <html lang> in step with the active locale.
 *
 * This is an accessibility requirement, not cosmetic: a screen reader picks its
 * pronunciation rules from this attribute, so German text announced as English
 * is close to unintelligible. index.html ships lang="de" for the very first
 * paint; from then on this owns it. */
function applyDocumentLocale(locale: string) {
  document.documentElement.lang = locale
  document.title = i18n.t('shell.documentTitle')
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Non-fatal: the choice simply will not survive a reload.
  }
  void i18n.changeLanguage(locale)
}

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: FALLBACK_LOCALE,
  interpolation: {
    // React escapes for us, and double-escaping mangles umlauts in interpolated
    // values.
    escapeValue: false,
    /* The Baden-Wuerttemberg coordinate bounds are a rule, not a wording. The
       two messages that name a range read them from here, so changing a bound
       stays one edit in regeln/koordinaten.ts and the locale file cannot drift
       away from what is actually enforced. */
    defaultVariables: {
      rechtswertMin: BW_GRENZEN.rechtswert.min,
      rechtswertMax: BW_GRENZEN.rechtswert.max,
      hochwertMin: BW_GRENZEN.hochwert.min,
      hochwertMax: BW_GRENZEN.hochwert.max,
    },
  },
})

applyDocumentLocale(i18n.language)
i18n.on('languageChanged', applyDocumentLocale)

export default i18n
