import Button from '@mui/material/Button'
import { useTheme } from '../hooks/useTheme'

/* A toggle button, so the label stays fixed and aria-pressed carries the state.
   Relabelling the button instead ("Helles Design") would make a screen reader
   announce the opposite of what is currently on screen. */
function ThemeToggle() {
  const { resolved, ready, toggle } = useTheme()

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      onClick={toggle}
      disabled={!ready}
      aria-pressed={resolved === 'dark'}
    >
      Dunkles Design
    </Button>
  )
}

export default ThemeToggle
