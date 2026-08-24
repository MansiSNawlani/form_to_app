/* The subset of design tokens MUI's palette needs, as real hex values.
 *
 * Why this duplicates src/styles/theme.css: MUI derives hover, disabled and
 * selected states with alpha(), which cannot parse a "var(--accent)" string, so
 * the palette has to hold literal colours. Only the values MUI actually consumes
 * are mirrored here. Everything else stays a CSS custom property and is used
 * directly by our own components.
 *
 * Keep in sync with src/styles/theme.css. That file is the source of truth and
 * the approved mockups in prototypes/ are written against its variable names.
 */

export interface PaletteTokens {
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  faint: string
  accent: string
  accentHover: string
  accentInk: string
  accentSoft: string
  focus: string
  ok: string
  warn: string
  danger: string
  info: string
}

export const lightTokens: PaletteTokens = {
  bg: '#eef1f5',
  surface: '#ffffff',
  border: '#d3dae2',
  text: '#16202b',
  muted: '#4f5c6b',
  faint: '#78848f',
  accent: '#17457a',
  accentHover: '#0e3160',
  accentInk: '#ffffff',
  accentSoft: '#e5edf6',
  focus: '#1a6fd4',
  ok: '#1d6b40',
  warn: '#8a5300',
  danger: '#a0181f',
  info: '#1f4f77',
}

export const darkTokens: PaletteTokens = {
  bg: '#10161d',
  surface: '#18202a',
  border: '#2d3945',
  text: '#e8edf2',
  muted: '#a8b4c0',
  faint: '#7d8996',
  accent: '#6ba3e0',
  // Lighter than the accent, not darker. On a dark surface the hover state has
  // to gain contrast, so this is inverted relative to the light scheme.
  accentHover: '#8fbcec',
  accentInk: '#0c1218',
  accentSoft: '#1b2c3f',
  focus: '#79b4f5',
  ok: '#6cc38d',
  warn: '#e0a851',
  danger: '#ef8a8f',
  info: '#7fb2d8',
}

export const fontSans =
  '"Source Sans 3", "Segoe UI", system-ui, -apple-system, sans-serif'

export const radius = 4
