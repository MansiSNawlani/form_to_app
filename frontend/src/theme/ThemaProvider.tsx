import { ThemeProvider } from '@mui/material/styles'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { spracheFuer } from '../i18n/sprachen'
import { muiTheme } from './muiTheme'

/* MUI's theme, in the language the interface is in.
 *
 * useTranslation re-renders this when the language changes, which is what makes
 * MUI's own texts switch with ours instead of staying in whatever language the
 * page first loaded in. */
function ThemaProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const texte = spracheFuer(i18n.language).mui
  const theme = useMemo(() => muiTheme(texte), [texte])

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      {children}
    </ThemeProvider>
  )
}

export default ThemaProvider
