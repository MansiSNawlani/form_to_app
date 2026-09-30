import { deDE, enUS, type Localization } from '@mui/material/locale'
import { deDE as pickerDeDE, enUS as pickerEnUS } from '@mui/x-date-pickers/locales'

/* Which locales the application has, and how each one formats, with no i18next
 * attached.
 *
 * Its own module rather than a constant in index.ts, which is where it started.
 * That file initialises i18next as it is imported: it loads both locale files,
 * reads localStorage and wires up react-i18next. Anything importing the list from
 * there got all of that too, which is why eingabe.ts could no longer be tested in
 * a node environment the moment it asked which locales exist.
 *
 * So the list lives here, where importing it needs no browser, and index.ts
 * re-exports it so every existing caller is unaffected. The MUI locale objects
 * imported above are plain data and keep that true.
 */

export const SUPPORTED_LOCALES = ['de', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/* German, and never English. The domain is German, the legacy form is German, and
 * a missing key should degrade to the language the content was written in rather
 * than to a half-built translation. */
export const FALLBACK_LOCALE: Locale = 'de'

/* Everything that changes with the language apart from our own texts, one row per
 * locale, so a third language later is one new row here.
 *
 * format is what Intl receives. en-GB rather than plain en, which Intl reads as
 * en-US: every reader is in or around Baden-Wuerttemberg, and a US date would put
 * the month first and read 03/04 as 4 March. Numeric dates the app writes itself,
 * such as 30.09.2026 in the lists, stay as the official form writes them in both
 * languages; only dates spelt out in words follow this.
 *
 * name is the language in itself, "English" in the German interface too, so
 * somebody who cannot read the current one can still find their own.
 */
export interface Sprache {
  name: string
  format: string
  dayjs: string
  mui: Localization
  datumsauswahl: DatumsauswahlTexte
}

type DatumsauswahlTexte =
  typeof pickerDeDE.components.MuiLocalizationProvider.defaultProps.localeText

export const SPRACHEN: Record<Locale, Sprache> = {
  de: {
    name: 'Deutsch',
    format: 'de-DE',
    dayjs: 'de',
    mui: deDE,
    datumsauswahl: pickerDeDE.components.MuiLocalizationProvider.defaultProps.localeText,
  },
  en: {
    name: 'English',
    format: 'en-GB',
    dayjs: 'en-gb',
    mui: enUS,
    datumsauswahl: pickerEnUS.components.MuiLocalizationProvider.defaultProps.localeText,
  },
}

/* The row for whatever i18next reports, which is typed as any string. Anything
 * not in the table gets German, the same fallback the texts use. */
export function spracheFuer(locale: string): Sprache {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? SPRACHEN[locale as Locale]
    : SPRACHEN[FALLBACK_LOCALE]
}
