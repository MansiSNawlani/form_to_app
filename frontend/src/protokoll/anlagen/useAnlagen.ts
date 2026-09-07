import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParseKeys } from 'i18next'
import { pruefeAnlage } from './regeln'
import { anlagenStore, type FailureReason } from './store'
import type { Anlage, Anlagenart } from './typen'

/* One kind of attachment for one draft: what is there, what went wrong, and the
 * three things a block can do about it.
 *
 * The blocks never apply the rules themselves and never hold a database handle.
 * That keeps the order that matters, check then write then report, in one place
 * instead of twice over, and it leaves store.ts as the single seam feature 3
 * replaces with API calls.
 */

export interface Meldung {
  /** For React's key only. A message can repeat within one pick. */
  id: number
  schluessel: ParseKeys
  werte: Record<string, number | string>
}

export type AnlagenStatus = 'loading' | 'loaded' | 'unavailable'

export interface UseAnlagen {
  status: AnlagenStatus
  anlagen: Anlage[]
  meldungen: Meldung[]
  hinzufuegen: (dateien: File[]) => Promise<void>
  /** Drops whatever is there and puts this in its place. The single slot only. */
  ersetzen: (datei: File) => Promise<void>
  entfernen: (id: string) => Promise<void>
}

type MeldungFactory = (
  schluessel: ParseKeys,
  werte: Record<string, number | string>,
) => Meldung

/* Why one file did not go in, as opposed to why the block as a whole is
 * unusable. Both come out of the same storage failure, and they are separate
 * messages because only one of them has a file to name. */
function failureKey(reason: FailureReason): ParseKeys {
  return reason === 'full'
    ? 'protokoll.anlagen.fehler.speicherVoll'
    : 'protokoll.anlagen.fehler.dateiNichtGespeichert'
}

/* Files are taken in turn rather than as a batch, and the running count rises
 * as each one is accepted. A pick of five against eighteen therefore stores two
 * and refuses three, instead of refusing all five or storing all five.
 *
 * Outside the hook because it needs nothing from React, which also makes the
 * ordering readable on its own rather than buried among callbacks.
 */
async function storeFiles(
  entwurfId: string,
  art: Anlagenart,
  dateien: File[],
  vorhanden: number,
  meldung: MeldungFactory,
) {
  const angenommen: Anlage[] = []
  const fehler: Meldung[] = []
  let anzahl = vorhanden

  for (const datei of dateien) {
    const verstoss = pruefeAnlage(datei, art, anzahl)
    if (verstoss !== null) {
      fehler.push(meldung(verstoss.schluessel, verstoss.werte))
      continue
    }

    const result = await anlagenStore.addAnlage(entwurfId, art, datei)
    if (result.status === 'failed') {
      fehler.push(meldung(failureKey(result.reason), { dateiname: datei.name }))
      continue
    }

    angenommen.push(result.anlage)
    anzahl += 1
  }

  return { angenommen, fehler }
}

/* What came of trying to replace the single slot's file.
 *
 * 'stale' is the awkward one: the new file went in but the old one would not
 * come out, so the store now holds both and only a fresh read can say what the
 * screen should show. */
type ReplaceResult =
  | { status: 'replaced'; anlagen: Anlage[]; fehler: Meldung[] }
  | { status: 'rejected'; fehler: Meldung[] }
  | { status: 'stale'; fehler: Meldung[] }

/* The single slot's replace: the new file lands first, and the old one goes
 * only once it has.
 *
 * The order is the whole point. Removing first would mean that picking a HEIC
 * photograph, or picking anything at all with a full disk, destroys the map
 * excerpt that was already there and puts nothing in its place. Nothing is lost
 * here unless the replacement actually arrived.
 *
 * The rule is asked about a count of zero rather than the real one, which is
 * the honest question: the surveyor asked to replace, not to add a second.
 * Being briefly over the cap in the store is fine, because the cap is a rule
 * about the form and not an invariant of the database.
 *
 * Beside storeFiles rather than inside the hook, because both are orderings
 * that have to be right and neither needs React to be read.
 */
async function replaceFile(
  entwurfId: string,
  art: Anlagenart,
  datei: File,
  alt: Anlage | undefined,
  meldung: MeldungFactory,
): Promise<ReplaceResult> {
  const { angenommen, fehler } = await storeFiles(entwurfId, art, [datei], 0, meldung)

  if (angenommen.length === 0) return { status: 'rejected', fehler }

  if (alt !== undefined && !(await anlagenStore.removeAnlage(alt.id))) {
    /* Saying nothing would leave the screen showing the new file while a reload
       brought back the old, which reads as the replace having silently undone
       itself. */
    fehler.push(
      meldung('protokoll.anlagen.fehler.nichtEntfernt', { dateiname: alt.dateiname }),
    )
    return { status: 'stale', fehler }
  }

  return { status: 'replaced', anlagen: angenommen, fehler }
}

export function useAnlagen(entwurfId: string, art: Anlagenart): UseAnlagen {
  const [status, setStatus] = useState<AnlagenStatus>('loading')
  const [anlagen, setAnlagen] = useState<Anlage[]>([])
  const [meldungen, setMeldungen] = useState<Meldung[]>([])

  // Only ever counts up, so two identical refusals in one pick stay two rows.
  const meldungsId = useRef(0)
  const meldung = useCallback<MeldungFactory>((schluessel, werte) => {
    meldungsId.current += 1
    return { id: meldungsId.current, schluessel, werte }
  }, [])

  /* Reads the store and works out what the block should show, without touching
     state. Returning rather than setting is what lets the opening read throw a
     stale answer away: reading is asynchronous here, unlike the draft store, so
     a slow first load can otherwise land after a fast second one and put the
     previous draft's attachments on screen. */
  const lesen = useCallback(async () => {
    const result = await anlagenStore.listAnlagen(entwurfId)
    if (result.status === 'unavailable') {
      return { status: 'unavailable' as const, anlagen: [] }
    }
    return {
      status: 'loaded' as const,
      anlagen: result.anlagen.filter((anlage) => anlage.art === art),
    }
  }, [entwurfId, art])

  const anwenden = useCallback((zustand: { status: AnlagenStatus; anlagen: Anlage[] }) => {
    setStatus(zustand.status)
    setAnlagen(zustand.anlagen)
  }, [])

  useEffect(() => {
    let aktuell = true
    void lesen().then((zustand) => {
      if (aktuell) anwenden(zustand)
    })
    return () => {
      aktuell = false
    }
  }, [lesen, anwenden])

  const hinzufuegen = useCallback(
    async (dateien: File[]) => {
      const { angenommen, fehler } = await storeFiles(
        entwurfId,
        art,
        dateien,
        anlagen.length,
        meldung,
      )
      if (angenommen.length > 0) setAnlagen((bisher) => [...bisher, ...angenommen])
      setMeldungen(fehler)
    },
    [anlagen.length, art, entwurfId, meldung],
  )

  const ersetzen = useCallback(
    async (datei: File) => {
      const result = await replaceFile(entwurfId, art, datei, anlagen[0], meldung)

      if (result.status === 'replaced') setAnlagen(result.anlagen)
      // The store holds both files, so the screen has to follow it rather than
      // what was intended.
      if (result.status === 'stale') anwenden(await lesen())
      setMeldungen(result.fehler)
    },
    [anlagen, anwenden, art, entwurfId, lesen, meldung],
  )

  const entfernen = useCallback(
    async (id: string) => {
      const anlage = anlagen.find((eintrag) => eintrag.id === id)

      /* A failed removal is not the same as a browser that stores nothing at
         all, even though both come out of the same call. Treating it as the
         latter would blank the whole block and tell the surveyor to switch
         browsers over one file that is still perfectly there. */
      if (!(await anlagenStore.removeAnlage(id))) {
        setMeldungen([
          meldung('protokoll.anlagen.fehler.nichtEntfernt', {
            dateiname: anlage?.dateiname ?? '',
          }),
        ])
        return
      }

      setAnlagen((bisher) => bisher.filter((eintrag) => eintrag.id !== id))
      // A removal answers whatever the last pick complained about.
      setMeldungen([])
    },
    [anlagen, meldung],
  )

  return { status, anlagen, meldungen, hinzufuegen, ersetzen, entfernen }
}
