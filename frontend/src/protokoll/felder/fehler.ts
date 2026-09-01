import type { ParseKeys } from 'i18next'
import { useFormContext, useFormState } from 'react-hook-form'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* What one field currently has wrong with it, as a translation key.
 *
 * Subscribed per field: useFormState with a name re-renders this field alone.
 * Pulling formState.errors into the page and passing it down would re-render
 * all 338 fields on every keystroke, which is the thing coding-standards.md
 * chose React Hook Form to avoid.
 */
export function useFeldFehler(name: AntwortPfad): ParseKeys | undefined {
  const { getFieldState } = useFormContext<Antworten>()
  const formState = useFormState<Antworten>({ name })
  const { error } = getFieldState(name, formState)

  /* Only regeln/schema.ts ever sets a message, and it only ever sets a key out
     of de.json, so this narrowing is safe in a way the types cannot say. */
  return error?.message as ParseKeys | undefined
}
