/* Moving a protocol from one state to the next, from the rail.
 *
 * Two mutations over the calls 11e wrote, sharing what they do afterwards.
 * useMutation rather than a bare call, for the reason absenden/useAbsenden.ts
 * gives: a button that can fail needs its pending and error state on screen, and
 * that is what useMutation is for. The automatic save is the deliberate
 * exception, and it is not a button.
 *
 * **What every successful move invalidates is the point of this module.** Three
 * cache entries say something different afterwards and they are easy to forget
 * one of: the protocol's own document carries the status the badge prints, the
 * history has gained a line, and the row in Meine Protokolle has moved. Written
 * once here so the two mutations cannot drift apart.
 *
 * Refetching the protocol is safe here although entwurf/abfragen.ts forbids it
 * behind the form's back. That rule protects answers the browser holds and the
 * server has not seen; this page holds none, because nothing on it is typed.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { entwurfsKey, protokolleKey } from '../entwurf/abfragen'
import { verlaufsKey } from './abfragen'
import { entscheide, nimmInPruefung } from './api'
import type { Entscheidung, UebergangAntwort } from './typen'

function useNachUebergang(id: string) {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: entwurfsKey(id) })
    void queryClient.invalidateQueries({ queryKey: verlaufsKey(id) })
    void queryClient.invalidateQueries({ queryKey: protokolleKey() })
  }
}

/* Picking a protocol up, which says so to colleagues and nothing more.
 *
 * Optional: backend/app/protokolle/uebergang/regeln.py lets a decision be made
 * straight from SUBMITTED, because nothing here reserves a protocol to one
 * reviewer.
 */
export function useInPruefungNehmen(id: string) {
  const nachUebergang = useNachUebergang(id)

  return useMutation<UebergangAntwort, unknown, void>({
    mutationFn: () => nimmInPruefung(id),
    onSuccess: nachUebergang,
  })
}

export interface Entscheidungseingabe {
  entscheidung: Entscheidung
  /* Trimmed by the caller, and absent rather than empty when nothing was
     written: the API's kommentar is optional, and an empty string is a reason
     somebody gave rather than one they left out. */
  kommentar?: string
}

export function useEntscheiden(id: string) {
  const nachUebergang = useNachUebergang(id)

  return useMutation<UebergangAntwort, unknown, Entscheidungseingabe>({
    mutationFn: ({ entscheidung, kommentar }) => entscheide({ id, entscheidung, kommentar }),
    onSuccess: nachUebergang,
  })
}
