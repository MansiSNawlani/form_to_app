import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { entwurfsKey, protokolleKey } from '../entwurf/abfragen'
import { loescheEntwurf } from '../entwurf/api'
import { sicherungsStore } from '../entwurf/sicherung'
import type { Uebersicht } from '../entwurf/typen'

/* Throwing a draft away: the question, the request, and what is left over.
 *
 * A hook rather than three pieces of state in the page, because the three belong
 * together: which protocol was asked about, whether the request is in flight,
 * and what to say if it failed.
 *
 * Nothing here is optimistic. The row stays until the server confirms, because
 * this cannot be undone and a row that vanished and came back would be worse
 * than one that took a moment to go.
 */
export function useLoeschen() {
  /* The whole row, not its id. The question names the protocol, and looking the
     name back up from an id would mean the dialog re-reading a list the delete
     is about to change. */
  const [angefragt, setAngefragt] = useState<Uebersicht | null>(null)
  const [fehlgeschlagen, setFehlgeschlagen] = useState<Uebersicht | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (zeile: Uebersicht) => {
      await loescheEntwurf(zeile.id)

      /* The safety copy is the only thing this browser still holds for a deleted
         protocol. Feature 3d moved the attachments to the server, which deletes
         them along with the protocol, so the browser cleanup this used to do is
         the server's job now and the module that did it is gone.

         Only after the server said yes, which is the part that matters: clearing
         the copy first would throw away the one remaining record of unsaved
         answers if the request then failed. It swallows its own failures and is
         synchronous localStorage, so nothing here can turn a completed delete
         into a reported one. */
      sicherungsStore.loesche(zeile.id)
    },
    onSuccess: (_ergebnis, zeile) => {
      /* The document itself, so a stale copy cannot be handed to a page opened
         at the deleted address later in this session. removeQueries rather than
         invalidate: there is nothing left to refetch. */
      queryClient.removeQueries({ queryKey: entwurfsKey(zeile.id) })
      void queryClient.invalidateQueries({ queryKey: protokolleKey() })
      setAngefragt(null)
    },
    onError: (_fehler, zeile) => {
      /* The dialog closes either way. Leaving it open over a failure hides the
         list the message is about, and the row is still there to try again
         from. */
      setAngefragt(null)
      setFehlgeschlagen(zeile)
    },
  })

  return {
    /** The protocol awaiting confirmation, or null when none is. */
    angefragt,
    /** The protocol whose delete failed, so the message can name it. */
    fehlgeschlagen,
    fehler: mutation.error,
    laeuft: mutation.isPending,
    frage: (zeile: Uebersicht) => {
      setFehlgeschlagen(null)
      mutation.reset()
      setAngefragt(zeile)
    },
    abbrechen: () => {
      setAngefragt(null)
    },
    bestaetigen: () => {
      if (angefragt !== null) mutation.mutate(angefragt)
    },
  }
}
