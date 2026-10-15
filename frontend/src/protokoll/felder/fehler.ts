import type { ParseKeys } from 'i18next'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { bekannteMeldung, feldMeldung } from '../absenden/amFeld'
import { useServerVerstoss } from '../absenden/verstossKontext'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* What one field currently has wrong with it, as a translation key.
 *
 * Two sources. The browser's own rules, through React Hook Form, and since the
 * fix of 2026-10-15 what the server refused at the last submit or import, so
 * the field it named is red as well as listed.
 *
 * Subscribed per field: useFormState with a name re-renders this field alone.
 * Pulling formState.errors into the page and passing it down would re-render
 * all 338 fields on every keystroke, which is the thing coding-standards.md
 * chose React Hook Form to avoid.
 */
export function useFeldFehler(name: AntwortPfad): ParseKeys | undefined {
  const { getFieldState, getValues } = useFormContext<Antworten>()
  const formState = useFormState<Antworten>({ name })
  const { error } = getFieldState(name, formState)
  const { i18n } = useTranslation()
  const server = useServerVerstoss(name)

  /* Watched only while the server has something to say about this field, so
     that filling it in takes the red away at once. Every other field stays as
     it was: a keystroke re-renders nothing. The value itself is read with
     getValues, which is current on every render, rather than taken from
     useWatch, whose own copy can be a render behind after being switched on. */
  useWatch<Antworten>({ name, disabled: server === undefined })
  const wert = server === undefined ? undefined : getValues(name)

  /* Only regeln/schema.ts ever sets a message, and it only ever sets a key out
     of de.json, so this narrowing is safe in a way the types cannot say. */
  const browser = error?.message as ParseKeys | undefined

  return feldMeldung(
    browser,
    server === undefined ? undefined : bekannteMeldung(server, (k) => i18n.exists(k)),
    wert,
  )
}
