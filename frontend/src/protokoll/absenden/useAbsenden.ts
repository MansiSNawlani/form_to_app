/* Pressing Absenden, and what comes of it.
 *
 * Kept apart from the button so the sequencing can be read in one place: flush
 * the saving, post, and then either leave for Meine Protokolle or hold on to
 * what the server refused.
 *
 * useMutation rather than a bare call, unlike the automatic save. The save
 * avoids it because subscribing to its state would re-render the whole open
 * section on every keystroke burst, which was measured at 206ms on the catch
 * table. Submitting happens once, deliberately, and the pending state is exactly
 * what the button needs.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ApiFehler,
  PROTOKOLL_NICHT_MEHR_ENTWURF,
  PROTOKOLL_UNVOLLSTAENDIG,
} from '../../api/fehler'
import type { Verstoss } from '../../api/typen'
import { absendeProtokoll } from '../entwurf/api'
import { protokolleKey } from '../entwurf/abfragen'

/** Where the list of a person's own protocols lives. */
const UEBERSICHT = '/protokolle'

export interface AbsendenOptionen {
  entwurfId: string
  /* Everything typed is on the server, and the version it is now at. null when
     the last save failed, in which case nothing is sent: submitting a version we
     know is stale would be refused anyway, and with a message about a second tab
     that does not exist. */
  bereitZumAbsenden: () => Promise<number | null>
}

export interface Absenden {
  absenden: () => void
  /* Put the panel away. A fresh attempt brings back a fresh answer, so nothing
     is lost by closing it; a list of forty-seven entries sitting above every
     section is an obstacle once somebody knows what is on it. */
  verwerfen: () => void
  laeuft: boolean
  /* What the server refused, or an empty list. Always an array, so the panel can
     map over it without asking first. */
  verstoesse: readonly Verstoss[]
  /* A refusal that is not about the contents: a conflict, a lost session, an
     unreachable server. Null when there is none. */
  fehler: unknown
  /* The protocol was already submitted, which is what pressing the button twice
     looks like, and what a lost answer on the way back looks like. Nothing went
     wrong for the person: it is sent. */
  bereitsAbgesendet: boolean
}

export function useAbsenden({ entwurfId, bereitZumAbsenden }: AbsendenOptionen): Absenden {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [verstoesse, setVerstoesse] = useState<readonly Verstoss[]>([])
  const [fehler, setFehler] = useState<unknown>(null)
  const [bereitsAbgesendet, setBereitsAbgesendet] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const version = await bereitZumAbsenden()
      if (version === null) throw new NichtGespeichert()
      return absendeProtokoll({ id: entwurfId, version })
    },
    onSuccess: () => {
      /* The list is fetched fresh rather than patched, because the row that
         changed is not the only thing that moved: the count line above the table
         reads "davon 2 Entwürfe" and this protocol has just stopped being one. */
      void queryClient.invalidateQueries({ queryKey: protokolleKey() })
      void navigate(UEBERSICHT)
    },
    onError: (grund: unknown) => {
      setVerstoesse([])
      setFehler(null)
      setBereitsAbgesendet(false)

      if (!(grund instanceof ApiFehler)) {
        setFehler(grund)
        return
      }

      if (grund.code === PROTOKOLL_UNVOLLSTAENDIG) {
        setVerstoesse(grund.verstoesse)
        return
      }

      /* Already sent. The backend's own sentence is written for a save arriving
         late and tells the person to reload the page, which is the wrong errand:
         the protocol went through, and what they want is the list. */
      if (grund.code === PROTOKOLL_NICHT_MEHR_ENTWURF) {
        setBereitsAbgesendet(true)
        return
      }

      setFehler(grund)
    },
  })

  const { mutate, isPending } = mutation

  const absenden = useCallback(() => {
    /* Cleared before the attempt rather than after it. A panel left over from
       the previous try, sitting above a protocol somebody has just repaired,
       reads as though the repair did not take. */
    setVerstoesse([])
    setFehler(null)
    setBereitsAbgesendet(false)
    mutate()
  }, [mutate])

  const verwerfen = useCallback(() => {
    setVerstoesse([])
    setFehler(null)
    setBereitsAbgesendet(false)
  }, [])

  return { absenden, verwerfen, laeuft: isPending, verstoesse, fehler, bereitsAbgesendet }
}

/* The one failure this hook raises itself: the protocol is not on the server as
 * it stands, because a save was refused.
 *
 * Its own type rather than a string, so the button can say something true about
 * it. Submitting anyway would post a version the server has already moved past,
 * and the surveyor would be told about a conflict instead of about the save that
 * actually failed.
 */
export class NichtGespeichert extends Error {
  constructor() {
    super('Not every change is saved, so nothing was submitted')
    this.name = 'NichtGespeichert'
  }
}
