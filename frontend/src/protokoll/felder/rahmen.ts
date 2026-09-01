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

/** The hint's id, so the control can point aria-describedby at it. */
export function hinweisId(id: string, hinweisKey?: ParseKeys) {
  return hinweisKey ? `${id}-hinweis` : undefined
}
