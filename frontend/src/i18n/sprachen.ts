/* Which locales the application has, with nothing else attached.
 *
 * Its own module rather than a constant in index.ts, which is where it started.
 * That file initialises i18next as it is imported: it loads both locale files,
 * reads localStorage and wires up react-i18next. Anything importing the list from
 * there got all of that too, which is why eingabe.ts could no longer be tested in
 * a node environment the moment it asked which locales exist.
 *
 * So the list lives here, where importing it costs nothing, and index.ts re-exports
 * it so every existing caller is unaffected.
 */

export const SUPPORTED_LOCALES = ['de', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/* German, and never English. The domain is German, the legacy form is German, and
 * a missing key should degrade to the language the content was written in rather
 * than to a half-built translation. */
export const FALLBACK_LOCALE: Locale = 'de'
