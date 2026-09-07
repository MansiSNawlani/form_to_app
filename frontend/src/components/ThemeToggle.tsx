import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { MoonIcon, SunIcon } from './icons'
import { useTheme } from '../hooks/useTheme'

/* A toggle button, so the label stays fixed and aria-pressed carries the state.
   Relabelling the button instead would make a screen reader announce the
   opposite of what is currently on screen: "Helles Design" while the screen is
   dark reads as a statement about the theme rather than about the click.

   The icon is the visual half of that same state. It shows which theme is on
   now, a sun for light and a moon for dark, exactly as aria-pressed does for a
   screen reader, so neither audience has to infer the state from the other's
   cue. The label names the setting; the icon and the pressed tint give its
   value. It is aria-hidden because saying it twice would be noise. */
function ThemeToggle() {
  const { resolved, ready, toggle } = useTheme()
  const { t } = useTranslation()

  const Icon = resolved === 'dark' ? MoonIcon : SunIcon

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      onClick={toggle}
      disabled={!ready}
      aria-pressed={resolved === 'dark'}
      /* Not startIcon: that prop sets Material's own icon margins, and this
         button is already sized by the sizeSmall override in muiTheme.ts. */
      className="theme-toggle"
    >
      <Icon className="theme-toggle__icon" fontSize="small" aria-hidden="true" />
      {t('shell.header.themeToggle')}
    </Button>
  )
}

export default ThemeToggle
