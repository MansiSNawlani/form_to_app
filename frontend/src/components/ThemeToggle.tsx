import IconButton from '@mui/material/IconButton'
import { useTranslation } from 'react-i18next'
import { MoonIcon, SunIcon } from './icons'
import { useTheme } from '../hooks/useTheme'

/* Icon only, to keep the header short.
 *
 * Still a toggle rather than an action, which is the decision feature 1a made
 * and this keeps: the name stays fixed and aria-pressed carries the state.
 * Renaming it to "Helles Design" while the screen is dark would read as a
 * statement about the theme rather than about the click.
 *
 * Dropping the text makes the accessible name load-bearing rather than a
 * courtesy: without aria-label this announces as "button" and nothing else, so
 * the label that used to be visible moves there. title carries the same string
 * so a mouse user can hover for it, which is worth having even though a touch
 * device cannot: a sun or a moon is a well-worn convention, and this is a
 * preference control rather than something a surveyor must find to do the job.
 *
 * The icon shows which theme is on now, a sun for light and a moon for dark,
 * which is what aria-pressed says to a screen reader. Neither audience has to
 * infer the state from the other's cue.
 */
function ThemeToggle() {
  const { resolved, ready, toggle } = useTheme()
  const { t } = useTranslation()

  const Icon = resolved === 'dark' ? MoonIcon : SunIcon
  const label = t('shell.header.themeToggle')

  return (
    <IconButton
      type="button"
      size="small"
      onClick={toggle}
      disabled={!ready}
      aria-pressed={resolved === 'dark'}
      aria-label={label}
      title={label}
    >
      <Icon fontSize="small" />
    </IconButton>
  )
}

export default ThemeToggle
