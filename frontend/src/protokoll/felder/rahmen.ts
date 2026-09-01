import type { ParseKeys } from 'i18next'

/* The shared shape of a field, kept apart from FeldRahmen.tsx so that file
   exports only its component. */

/** Grid columns, out of the twelve that .grid in protokoll.css lays down. */
export type Spalten = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export interface FeldRahmenProps {
  /* The control's id, which is also the field's legacy path. Dots are legal in
     an id and nothing selects these in CSS. */
  id: string
  labelKey: ParseKeys
  spalten: Spalten
  pflicht?: boolean
  hinweisKey?: ParseKeys
}

/** The hint's id, so a control can point aria-describedby at it. */
export function hinweisId(id: string, hatHinweis: boolean) {
  return hatHinweis ? `${id}-hinweis` : undefined
}

/** The error message's id, alongside the hint's rather than instead of it. */
export function fehlerId(id: string, hatFehler: boolean) {
  return hatFehler ? `${id}-fehler` : undefined
}

/** The label's own id, for a control that can only be named by reference. */
export function labelId(id: string) {
  return `${id}-label`
}

/* Everything a control is described by, in reading order.
 *
 * The hint and the error are both wanted: the hint under the
 * Monitoringstrecken-Nr. says when a number is needed at all, which is exactly
 * the context somebody needs while being told the number is missing. Replacing
 * one with the other would take that away from a screen reader user only. */
export function beschriebenVon(
  id: string,
  hinweisKey: ParseKeys | undefined,
  fehlerKey: ParseKeys | undefined,
) {
  const ids = [
    hinweisId(id, Boolean(hinweisKey)),
    fehlerId(id, Boolean(fehlerKey)),
  ].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
}

/* The aria attributes a real input needs. Not used by FeldAuswahl: MUI's Select
   reads aria-describedby as a prop of its own and turns the required flag into
   aria-required itself, and anything else handed to it lands on the hidden
   native input rather than on the combobox the user actually reaches. */
export function feldAria(
  name: string,
  pflicht: boolean | undefined,
  hinweisKey: ParseKeys | undefined,
  fehlerKey?: ParseKeys,
) {
  return {
    'aria-required': pflicht,
    // The red border is not a signal on its own, and aria-invalid is what says
    // "this one" to somebody who is not looking at the colour.
    'aria-invalid': fehlerKey ? true : undefined,
    'aria-describedby': beschriebenVon(name, hinweisKey, fehlerKey),
  }
}
