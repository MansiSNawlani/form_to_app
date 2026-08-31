import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'

/* A toggle button, so the label stays fixed and aria-pressed carries the state.
   Relabelling the button instead would make a screen reader announce the
   opposite of what is currently on screen. */
function ThemeToggle() {
  const { resolved, ready, toggle } = useTheme()
  const { t } = useTranslation()

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      onClick={toggle}
      disabled={!ready}
      aria-pressed={resolved === 'dark'}
    >
      {t('shell.header.themeToggle')}
    </Button>
  )
}

export default ThemeToggle
