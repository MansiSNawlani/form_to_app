/* Picking a PDF, and what comes of it.
 *
 * Kept apart from the page so the sequencing can be read in one place, the same
 * arrangement absenden/useAbsenden.ts uses: post the file, write down what the
 * server said about it, refresh the list, and leave for the new draft.
 *
 * useMutation rather than a bare call. Importing happens once, deliberately, and
 * the pending state is exactly what the button needs: a 2 MB protocol takes a
 * noticeable moment to go up and be read, and a slow upload with no pending
 * state looks precisely like a click that did nothing.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { pruefungsStore } from '../absenden/gemerkt'
import { protokolleKey } from '../entwurf/abfragen'
import { leseProtokollEin } from '../entwurf/api'
import { abschnittPfad } from '../abschnitte'
import { berichtstore } from './bericht'

export interface Einlesen {
  einlesen: (datei: File) => void
  /** Clear the refusal, so the page is not left wearing a stale one. */
  verwerfen: () => void
  laeuft: boolean
  /* What went wrong, or null. Always the whole error rather than a sentence, so
     the component can hand it to useFehlertext: every refusal this endpoint
     makes already carries German written to name the file, say why in ordinary
     words and say what to do instead. */
  fehler: unknown
}

export function useEinlesen(): Einlesen {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fehler, setFehler] = useState<unknown>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (datei: File) => leseProtokollEin({ datei }),

    onSuccess: ({ protokoll, bericht }) => {
      /* Both stores written here, in the one place that holds the whole report.
         Splitting them would mean a protocol could arrive showing half of what
         the server said about it, and the half missing would be silent. */

      /* The rules' complaints go where a refused Absenden already puts them, so
         the panel on the form draws them with nothing new built: grouped by
         section, folded, surviving a reload, and replaced by the server's fresh
         answer the next time Absenden is pressed. */
      if (bericht.verstoesse.length > 0) {
        pruefungsStore.schreib(protokoll.id, bericht.verstoesse)
      }

      /* And the two things that panel has no shape for, written for every
         import including one with nothing wrong with it: the arrival banner is
         drawn from this, and somebody opening the protocol has to be told it
         came out of a PDF and is a draft nobody has submitted. */
      berichtstore.schreib(protokoll.id, {
        quellversion: bericht.quellversion,
        unbrauchbar: bericht.unbrauchbar,
        bilder: bericht.bilder,
      })

      /* Fetched fresh rather than patched: the new row is not the only thing
         that moved, because the count line above the table reads "davon 2
         Entwürfe" and there is now one more. */
      void queryClient.invalidateQueries({ queryKey: protokolleKey() })

      /* Section 1, which is where a protocol starts. The occasion, the recorder
         and the Probestrecke are what somebody checks first on a protocol they
         did not type into this application themselves. */
      void navigate(abschnittPfad(protokoll.id, 1))
    },

    onError: (grund: unknown) => {
      setFehler(grund)
    },
  })

  const einlesen = useCallback(
    (datei: File) => {
      /* Cleared before the attempt rather than after it. A refusal left over
         from the previous pick, sitting above a file that is still going up,
         reads as though this one had failed too. */
      setFehler(null)
      mutate(datei)
    },
    [mutate],
  )

  const verwerfen = useCallback(() => {
    setFehler(null)
  }, [])

  return { einlesen, verwerfen, laeuft: isPending, fehler }
}
