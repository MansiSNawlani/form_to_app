import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParseKeys } from 'i18next'
import { pruefeAnlage } from './regeln'
import { anlagenStore } from './store'
import type { Anlage, Anlagenart } from './typen'

/* One kind of attachment for one draft: what is there, what went wrong, and the
 * two things a block can do about it.
 *
 * The blocks never touch the store or the rules directly. That keeps the
 * IndexedDB seam in store.ts, where feature 3 replaces it with API calls, and it
 * keeps the order of operations that matters, check then write then report, in
 * one place instead of twice over.
 */

export interface Meldung {
  /** For React's key only. A message can repeat within one pick. */
  id: number
  schluessel: ParseKeys
  werte: Record<string, number | string>
}

export type AnlagenStatus = 'laedt' | 'geladen' | 'nicht_verfuegbar'

export interface UseAnlagen {
  status: AnlagenStatus
  anlagen: Anlage[]
  meldungen: Meldung[]
  hinzufuegen: (dateien: File[]) => Promise<void>
  /** Drops whatever is there and puts this in its place. The single slot only. */
  ersetzen: (datei: File) => Promise<void>
  entfernen: (id: string) => Promise<void>
}

function speicherSchluessel(grund: 'voll' | 'nicht_verfuegbar'): ParseKeys {
  return grund === 'voll'
    ? 'protokoll.anlagen.fehler.speicherVoll'
    : 'protokoll.anlagen.fehler.speicherNichtVerfuegbar'
}

export function useAnlagen(entwurfId: string, art: Anlagenart): UseAnlagen {
  const [status, setStatus] = useState<AnlagenStatus>('laedt')
  const [anlagen, setAnlagen] = useState<Anlage[]>([])
  const [meldungen, setMeldungen] = useState<Meldung[]>([])

  // Only ever counts up, so two identical refusals in one pick stay two rows.
  const meldungsId = useRef(0)
  const naechsteMeldung = useCallback(
    (schluessel: ParseKeys, werte: Record<string, number | string>): Meldung => {
      meldungsId.current += 1
      return { id: meldungsId.current, schluessel, werte }
    },
    [],
  )

  useEffect(() => {
    /* Reading is asynchronous here, unlike the draft store, so a slow disk can
       land the answer after the section has been left. Writing to a gone
       component is a warning at best and a stale list at worst. */
    let aktuell = true

    void anlagenStore.listAnlagen(entwurfId).then((ergebnis) => {
      if (!aktuell) return
      if (ergebnis.status === 'nicht_verfuegbar') {
        setStatus('nicht_verfuegbar')
        return
      }
      setAnlagen(ergebnis.anlagen.filter((anlage) => anlage.art === art))
      setStatus('geladen')
    })

    return () => {
      aktuell = false
    }
  }, [entwurfId, art])

  /* Files are taken in turn rather than as a batch, and the running count rises
     as each one is accepted. A pick of five against eighteen therefore stores
     two and refuses three, instead of refusing all five or storing all five. */
  const aufnehmen = useCallback(
    async (dateien: File[], vorhandenZuBeginn: number) => {
      const angenommen: Anlage[] = []
      const fehler: Meldung[] = []
      let vorhanden = vorhandenZuBeginn

      for (const datei of dateien) {
        const verstoss = pruefeAnlage(datei, art, vorhanden)
        if (verstoss !== null) {
          fehler.push(naechsteMeldung(verstoss.schluessel, verstoss.werte))
          continue
        }

        const ergebnis = await anlagenStore.addAnlage(entwurfId, art, datei)
        if (ergebnis.status === 'fehlgeschlagen') {
          fehler.push(
            naechsteMeldung(speicherSchluessel(ergebnis.grund), {
              dateiname: datei.name,
            }),
          )
          continue
        }

        angenommen.push(ergebnis.anlage)
        vorhanden += 1
      }

      return { angenommen, fehler }
    },
    [art, entwurfId, naechsteMeldung],
  )

  const hinzufuegen = useCallback(
    async (dateien: File[]) => {
      const { angenommen, fehler } = await aufnehmen(dateien, anlagen.length)
      if (angenommen.length > 0) setAnlagen((bisher) => [...bisher, ...angenommen])
      setMeldungen(fehler)
    },
    [anlagen.length, aufnehmen],
  )

  /* The single slot's replace: the new file lands first, and the old one goes
     only once it has.

     The order is the whole point. Removing first would mean that picking a HEIC
     photograph, or picking anything at all with a full disk, destroys the map
     excerpt that was already there and puts nothing in its place. Nothing is
     lost here unless the replacement actually arrived.

     The rule is asked about a count of zero rather than the real one, which is
     the honest question: the surveyor asked to replace, not to add a second.
     Being briefly over the cap in the store is fine, because the cap is a rule
     about the form and not an invariant of the database. */
  const ersetzen = useCallback(
    async (datei: File) => {
      const alt = anlagen[0]
      const { angenommen, fehler } = await aufnehmen([datei], 0)

      if (angenommen.length === 0) {
        setMeldungen(fehler)
        return
      }

      if (alt !== undefined) await anlagenStore.removeAnlage(alt.id)
      setAnlagen(angenommen)
      setMeldungen(fehler)
    },
    [anlagen, aufnehmen],
  )

  const entfernen = useCallback(async (id: string) => {
    const entfernt = await anlagenStore.removeAnlage(id)
    if (!entfernt) {
      setStatus('nicht_verfuegbar')
      return
    }
    setAnlagen((bisher) => bisher.filter((anlage) => anlage.id !== id))
    // A removal answers whatever the last pick complained about.
    setMeldungen([])
  }, [])

  return { status, anlagen, meldungen, hinzufuegen, ersetzen, entfernen }
}
