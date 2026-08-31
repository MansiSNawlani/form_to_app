import 'i18next'
import type de from './locales/de.json'

/* Makes the German locale file the authority on what a valid key is.
 *
 * Without this, t('shell.footer.imprssum') compiles happily and renders the raw
 * key to the user at runtime. With it, the typo is a build failure. That matters
 * more here than on most projects: features 4 to 9 add several hundred keys to
 * a 338 field form, and a silently missing label is easy to miss in review.
 *
 * German is the source locale, so it and not English defines the key set. A key
 * that exists only in en.json is therefore also an error, which is the correct
 * direction: translations may lag, but they may not invent.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof de
    }
  }
}
