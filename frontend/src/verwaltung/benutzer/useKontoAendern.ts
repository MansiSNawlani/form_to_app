import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiFehler, ROLLE_FEHLT } from '../../api/fehler'
import type { BenutzerAntwort } from '../../api/typen'
import { SITZUNGS_KEY } from '../../auth/useSitzung'
import { BENUTZER_KEY, kontoKey } from './abfragen'
import { aendereKonto, setzeKontoPasswort, type KontoAendernAnfrage } from './api'

/* Writing to one account, and making every screen that shows it agree.
 *
 * useMutation rather than a bare call, for the reason absenden/useAbsenden.ts
 * gives: a button that can fail needs its pending and its error state on screen.
 *
 * **Three caches can hold a copy of an account and all three are updated here.**
 * Getting this wrong is not a small fault. The list would still show the old
 * address, which reads as a save that did not happen, and the header would still
 * greet the administrator under a name they have just changed.
 */

/* What every successful write does, whichever of the two endpoints it went to.
 *
 * The answer is written straight into this account's own entry rather than
 * invalidated, because the server has just sent the account back and fetching it
 * again would ask a question that is already answered.
 *
 * The list is invalidated exactly, not by prefix. kontoKey is built from
 * BENUTZER_KEY, so a prefix match would sweep up the entry set on the line above
 * and refetch it for nothing.
 */
function useNachDemSchreiben(id: string, istEigenes: boolean) {
  const queryClient = useQueryClient()

  return (konto: BenutzerAntwort) => {
    queryClient.setQueryData(kontoKey(id), konto)
    void queryClient.invalidateQueries({ queryKey: BENUTZER_KEY, exact: true })

    /* Your own account is also the session. Without this a Super Admin who
       switched their own language would keep the old one until the next reload,
       and one who corrected their own address would still see the old one in the
       header. useKontoSprache follows the session, so invalidating it is what
       makes the interface change at once. */
    if (istEigenes) void queryClient.invalidateQueries({ queryKey: SITZUNGS_KEY })
  }
}

/* A write refused because of the caller rather than the request.
 *
 * Only reachable one way: the caller's own SUPER_ADMIN was taken off them while
 * this page was open, by somebody else or in the card above. Reaching the page at
 * all means the account had the role when it loaded.
 *
 * The account is invalidated rather than the refusal being drawn in the card. The
 * page then refetches, is refused in its turn, and answers with KeineBerechtigung,
 * which is what the spec's refusal table asks for: a message about the caller
 * replaces the page instead of sitting inside one of three cards while the other
 * two still offer buttons that cannot work.
 */
function useBeiVerlorenerRolle(id: string) {
  const queryClient = useQueryClient()

  return (fehler: unknown) => {
    if (fehler instanceof ApiFehler && fehler.code === ROLLE_FEHLT) {
      void queryClient.invalidateQueries({ queryKey: kontoKey(id) })
    }
  }
}

/* Change an account.
 *
 * Called once per card that sends a PATCH, so each has its own pending and error
 * state: the Zugang card must not show a refusal that the Angaben card earned, and
 * a save in one must not grey out the button in the other.
 */
export function useKontoAendern(id: string, istEigenes: boolean) {
  const nachDemSchreiben = useNachDemSchreiben(id, istEigenes)
  const beiVerlorenerRolle = useBeiVerlorenerRolle(id)

  return useMutation<BenutzerAntwort, unknown, KontoAendernAnfrage>({
    mutationFn: (anfrage) => aendereKonto(id, anfrage),
    onSuccess: nachDemSchreiben,
    onError: beiVerlorenerRolle,
  })
}

/* Give the account a new password.
 *
 * The answer carries the account and never the password, so there is nothing here
 * to keep: what the panel afterwards shows is the value the browser already had in
 * hand, held in the card's own state and nowhere else.
 */
export function useKontoPasswort(id: string, istEigenes: boolean) {
  const nachDemSchreiben = useNachDemSchreiben(id, istEigenes)
  const beiVerlorenerRolle = useBeiVerlorenerRolle(id)

  return useMutation<BenutzerAntwort, unknown, string>({
    mutationFn: (passwort) => setzeKontoPasswort(id, passwort),
    onSuccess: nachDemSchreiben,
    onError: beiVerlorenerRolle,
  })
}
