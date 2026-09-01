import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { deDE } from '@mui/x-date-pickers/locales'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/de'

/* German dates and times for MUI's pickers.
 *
 * This is the reason the pickers are here at all rather than native date and
 * time inputs. A native input takes its format from the browser's own language
 * setting, which we cannot override, so a surveyor whose browser is English
 * would read mm/dd/yyyy and an AM/PM clock on an otherwise German government
 * form. These pickers follow the app instead.
 *
 * Fixed to German because the app is German today; en.json is still the stub
 * feature 17 fills in. When it does, the locale and localeText below follow
 * i18next's current language instead.
 */

// Needed to read "09:15" back out of a draft: dayjs parses ISO dates on its own
// but not a bare time against a format.
dayjs.extend(customParseFormat)

const deutscheTexte =
  deDE.components.MuiLocalizationProvider.defaultProps.localeText

function DatumsProvider({ children }: { children: ReactNode }) {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="de"
      localeText={deutscheTexte}
    >
      {children}
    </LocalizationProvider>
  )
}

export default DatumsProvider
