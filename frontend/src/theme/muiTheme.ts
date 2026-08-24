import { createTheme, type Shadows } from '@mui/material/styles'
import {
  darkTokens,
  fontSans,
  lightTokens,
  radius,
  type PaletteTokens,
} from './tokens'

/* The single mapping from our design tokens to MUI's theme.
 *
 * ADR 0006 chose MUI on the condition that it is themed rather than shipped
 * stock, so the app does not read as a Material app. That condition is enforced
 * here, in one file, and not with sx overrides scattered across components.
 *
 * Three deliberate departures from Material:
 *   - no elevation shadows anywhere, because the mockups are flat
 *   - a 4px radius rather than Material's rounder shapes
 *   - button labels in sentence case, not SHOUTING
 */

const palette = (t: PaletteTokens) => ({
  primary: {
    main: t.accent,
    dark: t.accentHover, // MUI uses .dark for the contained-button hover state
    light: t.accentSoft,
    contrastText: t.accentInk,
  },
  background: { default: t.bg, paper: t.surface },
  text: { primary: t.text, secondary: t.muted, disabled: t.faint },
  divider: t.border,
  success: { main: t.ok },
  warning: { main: t.warn },
  error: { main: t.danger },
  info: { main: t.info },
})

export const muiTheme = createTheme({
  // Points MUI's light and dark schemes at the same attribute our own CSS uses,
  // so one data-theme flip recolours both.
  cssVariables: { colorSchemeSelector: '[data-theme="%s"]' },
  colorSchemes: {
    light: { palette: palette(lightTokens) },
    dark: { palette: palette(darkTokens) },
  },
  shape: { borderRadius: radius },
  // Shadows is a fixed 25-tuple, which a filled array cannot satisfy structurally.
  shadows: Array<string>(25).fill('none') as unknown as Shadows,
  typography: {
    fontFamily: fontSans,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // The accessibility requirement calls for large targets, and --field-h
        // in theme.css sets that height for every control.
        root: { minHeight: 'var(--field-h)', paddingInline: '1rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: 'var(--surface)', minHeight: 'var(--field-h)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Visible focus is a requirement, not a default. MUI's own focus styling
        // varies per component, so one ring is defined here for everything.
        ':focus-visible': {
          outline: '2px solid var(--focus)',
          outlineOffset: '2px',
        },
      },
    },
  },
})
