/* Fetching the protocol as a PDF and handing it to the browser to save.
 *
 * Kept apart from the button the same way einlesen/useEinlesen.ts is: the
 * sequencing reads in one place, and the component is left with a label, a
 * pending state and a refusal.
 *
 * useMutation rather than a query. A download happens when somebody asks for
 * it, never on render, and the pending state is what the button needs: a
 * protocol with twenty photographs takes a noticeable moment to build, and a
 * slow download with no pending state looks exactly like a click that did
 * nothing.
 */

import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { apiDatei } from '../../api/client'
import { dateinameAus } from './dateiname'

export interface Herunterladen {
  herunterladen: () => void
  /** Clear the refusal, so the page is not left wearing a stale one. */
  verwerfen: () => void
  laeuft: boolean
  /* The whole error rather than a sentence, so the component can hand it to
     useFehlertext, which is where every refusal in this application is turned
     into German. */
  fehler: unknown
}

export function useHerunterladen(protokollId: string): Herunterladen {
  const [fehler, setFehler] = useState<unknown>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => apiDatei(`/protokolle/${protokollId}/pdf`),
    onSuccess: ({ blob, verfuegung }) => {
      speichere(blob, dateinameAus(verfuegung))
    },
    onError: (grund: unknown) => {
      setFehler(grund)
    },
  })

  const herunterladen = useCallback(() => {
    /* Cleared before the attempt rather than after it. A refusal left over from
       the previous press, sitting beside a download that is still running,
       reads as though this one had failed too. */
    setFehler(null)
    mutate()
  }, [mutate])

  const verwerfen = useCallback(() => {
    setFehler(null)
  }, [])

  return { herunterladen, verwerfen, laeuft: isPending, fehler }
}

/* How long to keep the object URL alive after the click. */
const FREIGABE_MS = 60_000

/* Saving a blob is a link click, because that is the only thing every browser
 * agrees on.
 *
 * **The URL is released later, not on the next line.** Clicking the link only
 * asks the browser to start a download; it has not read the blob yet when click()
 * returns, and revoking there means nothing is ever saved. It cost an afternoon
 * of a browser test that clicked a working button and waited for a download that
 * never came. A minute is far longer than any browser needs and still means a
 * protocol with photographs in it, several megabytes of it, does not stay
 * attached to a page somebody keeps open all day.
 */
function speichere(blob: Blob, dateiname: string): void {
  const adresse = URL.createObjectURL(blob)
  const verweis = document.createElement('a')
  verweis.href = adresse
  verweis.download = dateiname
  document.body.append(verweis)
  verweis.click()
  verweis.remove()
  setTimeout(() => {
    URL.revokeObjectURL(adresse)
  }, FREIGABE_MS)
}
