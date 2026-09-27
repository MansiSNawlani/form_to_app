import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BenutzerAntwort } from '../../api/typen'
import { BENUTZER_KEY } from './abfragen'
import { legeKontoAn, type KontoAnlegenAnfrage } from './api'

/* Creating the account, and making the list show it.
 *
 * useMutation rather than a bare call, for the reason absenden/useAbsenden.ts
 * gives: a button that can fail needs its pending and its error state on screen,
 * and that is what useMutation is for.
 *
 * **The invalidation is the point of having this as a module.** The account list
 * is cached under BENUTZER_KEY, which feature 16b exported for exactly this
 * moment, so a new account that did not invalidate it would be missing from the
 * list the administrator is sent to next, and would look like a save that had not
 * happened.
 *
 * The key is imported rather than retyped. Two halves of a cache spelling the same
 * key differently is how a list comes to disagree with the database.
 */
export function useKontoAnlegen() {
  const queryClient = useQueryClient()

  return useMutation<BenutzerAntwort, unknown, KontoAnlegenAnfrage>({
    mutationFn: legeKontoAn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BENUTZER_KEY })
    },
  })
}
