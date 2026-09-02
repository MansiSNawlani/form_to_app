import { createTheme, type Shadows } from '@mui/material/styles'
import { deDE } from '@mui/material/locale'
// Lets createTheme accept the date pickers' own component keys below.
import type {} from '@mui/x-date-pickers/themeAugmentation'
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
 *   - button and overline labels in sentence case, not SHOUTING
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

/* Type sizes are read from the CSS custom properties rather than restated as
 * numbers, so src/styles/theme.css stays the single source of truth for the
 * scale. Unlike the palette this is safe: MUI never runs a colour function over
 * a font size, so an unresolved var() string is passed straight through to CSS.
 *
 * The variant-to-token mapping follows the approved mockups, not Material's
 * defaults, which are far larger:
 *   h1  --step-2  the page title          (prototypes/mockup.css .page__title)
 *   h2  --step-1  a form section legend   (.form-section > legend)
 *   h3  --step-0  a sub-heading
 *   --step-3 is defined in theme.css but unused by any approved mockup. It stays
 *   available as a token and is deliberately not bound to a variant here.
 */
const heading = (size: string) => ({
  fontSize: size,
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: 'normal',
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
    // Matches --step-0. MUI's own default is 14, which would make every size it
    // computes for itself disagree with our scale.
    fontSize: 16,
    h1: heading('var(--step-2)'),
    h2: heading('var(--step-1)'),
    h3: heading('var(--step-0)'),
    // h4 to h6 are not used by any mockup. They are pinned to the smallest step
    // so Material's 2rem-plus defaults can never leak in through a stray variant.
    h4: heading('var(--step--1)'),
    h5: heading('var(--step--1)'),
    h6: heading('var(--step--1)'),
    subtitle1: { fontSize: 'var(--step-0)', fontWeight: 600, lineHeight: 1.4 },
    subtitle2: { fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: 'var(--step-0)', lineHeight: 1.5 },
    body2: { fontSize: 'var(--step--1)', lineHeight: 1.45 },
    caption: { fontSize: 'var(--step--1)', lineHeight: 1.4 },
    overline: {
      fontSize: 'var(--step--1)',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 'normal',
      textTransform: 'none',
    },
    button: {
      fontSize: 'var(--step-0)',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: 'normal',
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // The accessibility requirement calls for large targets, and --field-h
        // in theme.css sets that height for every control.
        root: { minHeight: 'var(--field-h)', paddingInline: '1rem' },
        // MUI's outlined button is accent-coloured. The mockups' secondary
        // button is neutral (prototypes/mockup.css .btn), so it is retoned here
        // rather than at each call site.
        outlined: {
          color: 'var(--text)',
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--surface)',
          '&:hover': {
            borderColor: 'var(--text)',
            backgroundColor: 'var(--surface-sunken)',
          },
          // A toggle button's pressed state has to be visible, not only
          // announced through aria-pressed.
          '&[aria-pressed="true"]': {
            color: 'var(--accent)',
            borderColor: 'var(--accent)',
            backgroundColor: 'var(--accent-soft)',
          },
        },
        /* A quiet inline action inside a field, such as clearing a radio group,
           rather than one of the page's own buttons. It sits in a row of
           controls and must not read as a thirteenth option, so it drops the
           control height that root sets and is toned down to hint weight. */
        text: {
          minHeight: 'auto',
          padding: '0.1rem 0.4rem',
          color: 'var(--muted)',
          fontSize: 'var(--step--1)',
          fontWeight: 400,
          textDecoration: 'underline',
          '&:hover': {
            color: 'var(--text)',
            backgroundColor: 'transparent',
          },
        },
        // Matches .btn--sm in the mockups, which is shorter than a form control
        // because it sits in the header bar rather than in a field row.
        sizeSmall: {
          minHeight: '2.1rem',
          paddingInline: '0.75rem',
          fontSize: 'var(--step--1)',
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        // The approved mockups put a small bold label above the field rather
        // than floating it into the border notch, so FormLabel carries the label
        // and InputLabel is not used. Material's own focus recolouring is
        // switched off: the field's border already shows focus, and a label that
        // changes colour as well reads as an error state.
        root: {
          fontSize: 'var(--step--1)',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '0.3rem',
          '&.Mui-focused': { color: 'var(--text)' },
        },
        asterisk: { color: 'var(--danger)' },
      },
    },
    // Material's radio and checkbox are accent-coloured once ticked and grey
    // otherwise, which at nine groups on one screen leaves the unanswered ones
    // looking disabled. --border-strong is the same edge every other control in
    // the mockups draws itself with. Both get it: they sit in the same row, so a
    // checkbox left on Material's grey beside a themed radio reads as broken.
    MuiRadio: {
      styleOverrides: {
        root: {
          color: 'var(--border-strong)',
          padding: '0.35rem',
          '&.Mui-checked': { color: 'var(--accent)' },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: 'var(--border-strong)',
          padding: '0.35rem',
          '&.Mui-checked': { color: 'var(--accent)' },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        // MUI hangs a label off a control with a negative left margin meant for
        // a full-width list row. These sit in a wrapping row inside a field, so
        // the offset is removed and the gap between options is set here instead.
        root: { marginLeft: 0, marginRight: '1.25rem' },
        label: { fontSize: 'var(--step-0)' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        // The hint under a field (prototypes/mockup.css .field__hint). MUI
        // indents it to line up with a floating label, which we do not use, so
        // it is pulled back flush with the control above it.
        root: {
          fontSize: 'var(--step--1)',
          color: 'var(--muted)',
          marginInline: 0,
          marginTop: '0.3rem',
        },
      },
    },
    MuiPickerPopper: {
      styleOverrides: {
        // Same reason as MuiMenu below: elevation is off everywhere by design,
        // so the calendar needs a border to separate it from the page.
        paper: { border: '1px solid var(--border)' },
      },
    },
    MuiSelect: {
      defaultProps: {
        /* No open or close animation. The menu floats over a page that
           re-renders while it is animating, because the save indicator's state
           sits at the top of the protocol screen and every change touches it. A
           menu caught mid-transition flickers and can take the click on the
           option the pointer happens to be over. Found on the Gewaessertyp and
           on the Quelle on 2026-09-02.
           An instant dropdown is also the better answer on a form of 338
           fields, where the animation is paid for on every one of them. */
        MenuProps: { transitionDuration: 0 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        // Elevation is off everywhere by design, so a dropdown needs a border of
        // its own to separate it from the page it floats over.
        paper: { border: '1px solid var(--border)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--surface)',
          minHeight: 'var(--field-h)',
          /* The mockup fills a wrong field as well as outlining it, and
             thickens the outline to 2px (prototypes/mockup.css .field--error
             input), so the error reads down a column of twenty fields rather
             than only up close. */
          '&.Mui-error': {
            backgroundColor: 'var(--danger-soft)',
            '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          },
        },
        // Coordinates, postcodes and telephone numbers are read by comparing
        // digit against digit, which proportional figures make harder
        // (prototypes/mockup.css .tabular).
        input: {
          '&[type="number"], &[type="tel"]': {
            fontVariantNumeric: 'tabular-nums',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Visible focus is a requirement, not a default. MUI's own focus styling
        // varies per component, so one ring is defined here for everything.
        ':focus-visible': {
          outline: '3px solid var(--focus)',
          outlineOffset: '2px',
        },
      },
    },
  },
  // MUI ships English defaults for its own internal strings: the Autocomplete's
  // "No options", pagination labels, and so on. Feature 9's species picker would
  // otherwise announce English inside an otherwise German form.
}, deDE)
