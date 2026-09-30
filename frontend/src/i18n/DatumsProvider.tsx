import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/de'
import 'dayjs/locale/en-gb'
import { spracheFuer } from './sprachen'

/* Dates and times for MUI's pickers, in the interface's language.
 *
 * This is the reason the pickers are here at all rather than native date and
 * time inputs. A native input takes its format from the browser's own language
 * setting, which we cannot override, so a surveyor whose browser is English
 * would read mm/dd/yyyy and an AM/PM clock on an otherwise German government
 * form. These pickers follow the app instead: the month and weekday names and
 * the picker's buttons switch with the language, while the date is still typed
 * as 30.09.2026 in both (FeldDatum pins the format, see i18n/sprachen.ts).
 */

// Needed to read "09:15" back out of a draft: dayjs parses ISO dates on its own
// but not a bare time against a format.
dayjs.extend(customParseFormat)

function DatumsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const sprache = spracheFuer(i18n.language)

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={sprache.dayjs}
      localeText={sprache.datumsauswahl}
    >
      {children}
    </LocalizationProvider>
  )
}

export default DatumsProvider
