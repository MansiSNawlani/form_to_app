import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'

/* The handful of icons this application draws.
 *
 * On MUI's own SvgIcon, which is the primitive it provides for exactly this, so
 * they inherit its sizing, its colour and its fontSize prop like any MUI icon
 * would. @mui/icons-material is deliberately not installed: it is roughly two
 * thousand icons for the three shapes below, and Material's icon set is one of
 * the loudest signals that an app is a Material app, which ADR 0006 says this
 * one must not look like. Revisit that if the count here grows past a dozen.
 *
 * Drawn as strokes rather than filled shapes so they sit at the same visual
 * weight as the interface's 1px borders instead of reading as solid blobs, and
 * so one currentColor covers both themes.
 */
const strichProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Light theme is active. */
export function SunIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} {...strichProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.4v2.1M12 19.5v2.1M12 2.4v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.4 12h2.1M19.5 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" />
    </SvgIcon>
  )
}

/** Dark theme is active. */
export function MoonIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} {...strichProps}>
      <path d="M20.8 13.4A8.6 8.6 0 0 1 10.6 3.2a8.6 8.6 0 1 0 10.2 10.2Z" />
    </SvgIcon>
  )
}

/* Points down when a menu is closed and up when it is open, which is the only
   thing on a button that says it opens one rather than doing something. */
export function ChevronIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props} {...strichProps}>
      <path d="m6 9.5 6 6 6-6" />
    </SvgIcon>
  )
}
