import type { ParseKeys } from 'i18next'
import { useFormContext, useFormState } from 'react-hook-form'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* What one field currently has wrong with it, as a translation key.
 *
 * Subscribed per field rather than read out of the whole form's error object:
 * useFormState with a name re-renders this field alone when its own error
 * appears or clears. Pulling formState.errors into the page and passing it down
 * would re-render all 338 fields on every keystroke, which is the thing
 * coding-standards.md chose React Hook Form to avoid.
 */
export function useFeldFehler(name: AntwortPfad): ParseKeys | undefined {
  const { getFieldState } = useFormContext<Antworten>()
  const formState = useFormState<Antworten>({ name })
  const { error } = getFieldState(name, formState)

  /* React Hook Form carries the message as a plain string. Only regeln/schema.ts
     ever sets one, and it only ever sets a key out of de.json, so narrowing it
     back to a key here is safe in a way the types cannot express. */
  return error?.message as ParseKeys | undefined
}
