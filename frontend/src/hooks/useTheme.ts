import { useColorScheme } from '@mui/material/styles'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/* One project-level API over MUI's colour-scheme manager.
 *
 * MUI owns the data-theme attribute on <html>, because muiTheme.ts points its
 * colorSchemeSelector at that same attribute. Setting the mode here therefore
 * recolours both MUI's components and our own token-styled CSS in one move, and
 * nothing else in the app should write that attribute directly.
 *
 * Persistence, the prefers-color-scheme default and cross-tab sync all come
 * from MUI. This wrapper exists so the rest of the app has one place to call,
 * and so feature 2 has an obvious seam: an account's stored theme preference
 * becomes a setMode() call, not a second storage mechanism.
 */
export function useTheme() {
  const { mode, systemMode, setMode } = useColorScheme()

  // 'system' means "whatever the OS says", so resolve it to what is on screen.
  const resolved: ResolvedTheme | undefined =
    mode === 'system' ? systemMode : mode

  return {
    mode,
    resolved,
    // Undefined until MUI has read storage and the media query on mount.
    ready: resolved !== undefined,
    setMode,
    toggle: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
  }
}
