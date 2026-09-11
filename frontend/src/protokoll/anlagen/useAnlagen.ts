import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParseKeys } from 'i18next'
import { ApiFehler } from '../../api/fehler'
import type { Bereitsteller } from '../entwurf/bereitstellen'
import { istNeu } from '../entwurf/neu'
import type { Anlagenzustand } from '../entwurf/speicherzustand'
import { ladeAnlageHoch, listeAnlagen, loescheAnlage } from './api'
import { pruefeAnlage } from './regeln'
import type { Anlage, Anlagenart } from './typen'

/* One kind of attachment for one draft: what is there, what went wrong, and the
 * three things a block can do about it.
 *
 * The blocks never apply the rules themselves and never talk to the API. That
 * keeps the order that matters, check then send then report, in one place
 * instead of twice over.
 *
 * Feature 3d moved the destination from this browser to the server. The shape
 * above stayed exactly as feature 10 left it, which is what it was built for,
 * but the failures underneath changed completely: a full disk and a browser that
 * refuses to store anything gave way to a session that ran out, a backend that
 * cannot be reached, and a file the server itself refused for a reason it can
 * describe better than we can.
 */

export interface Meldung {
  /** For React's key only. A message can repeat within one pick. */
  id: number
  /* Either a key we own or a sentence the server sent. The server's refusals
     already name the file, say why in ordinary words and say what to do about
     it, so repeating them in German here would be two wordings to keep in step
     and the backend's is the one the API documentation shows. */
  schluessel?: ParseKeys
  werte?: Record<string, number | string>
  text?: string
}

export type AnlagenStatus = 'loading' | 'loaded' | 'unavailable'

export interface UseAnlagen {
  status: AnlagenStatus
  anlagen: Anlage[]
  meldungen: Meldung[]
  /* Whether a pick is still going up. The picker is disabled while it is, so a
     slow upload cannot look like a click that did nothing and invite a second
     pick of the same files. */
  laeuft: boolean
  hinzufuegen: (dateien: File[]) => Promise<void>
  /** Drops whatever is there and puts this in its place. The single slot only. */
  ersetzen: (datei: File) => Promise<void>
  entfernen: (id: string) => Promise<void>
}

type MeldungFactory = (teile: Omit<Meldung, 'id'>) => Meldung

/* A proxy in front of the service answers 413 itself for a body past its own
 * limit, and that answer is HTML rather than our JSON, so it arrives as an
 * unreadable response rather than as ANLAGE_ZU_GROSS. Both mean the same thing
 * to the person reading, so both get the same sentence.
 *
 * Its own function, and exported, because it is the one piece of this file where
 * a wrong answer is possible and it needs no React to be asked.
 */
export function fehlerMeldung(fehler: unknown, dateiname: string): Omit<Meldung, 'id'> {
  if (fehler instanceof ApiFehler) {
    if (fehler.status === 413) {
      return { schluessel: 'protokoll.anlagen.fehler.groesseServer', werte: { dateiname } }
    }
    /* The backend's own sentence, shown as it stands. It was written to this
       project's standard: it names the file, says why without a MIME type or a
       byte count, and ends with something the reader can do. */
    if (fehler.nachricht !== null) return { text: fehler.nachricht }
  }

  /* Nothing answered, or something we could not read. Ours to describe, and the
     important half is that the file was not stored, so nobody goes away thinking
     it was. */
  return { schluessel: 'protokoll.anlagen.fehler.nichtGesendet', werte: { dateiname } }
}

/* What the header should say once a pick has been dealt with.
 *
 * The newest created_at of what actually landed, which is the server's own
 * timestamp rather than this browser's clock, so the indicator agrees with the
 * record. Nothing at all when every file was refused: the block is already
 * naming each one and what to do about it, the answers are perfectly safe, and
 * the header has nothing to add that would not be vaguer.
 *
 * Outside the hook because it needs nothing from React and because it is the
 * kind of small decision worth being able to read on its own.
 */
function zuletztGespeichert(angenommen: Anlage[]): Anlagenzustand {
  if (angenommen.length === 0) return null

  const zeitpunkt = angenommen.reduce(
    (spaeteste, anlage) => (anlage.created_at > spaeteste ? anlage.created_at : spaeteste),
    angenommen[0].created_at,
  )
  return { status: 'saved', zeitpunkt }
}

/* Files are taken in turn rather than as a batch, and the running count rises
 * as each one is accepted. A pick of five against eighteen therefore stores two
 * and refuses three, instead of refusing all five or storing all five.
 *
 * Outside the hook because it needs nothing from React, which also makes the
 * ordering readable on its own rather than buried among callbacks.
 */
async function sendeDateien(
  entwurfId: string,
  bereitstellen: Bereitsteller,
  art: Anlagenart,
  dateien: File[],
  vorhanden: number,
  meldung: MeldungFactory,
) {
  const angenommen: Anlage[] = []
  const fehler: Meldung[] = []
  let anzahl = vorhanden

  for (const datei of dateien) {
    /* Asked in the browser first, so an obvious refusal costs no upload at all.
       The server asks the same questions again and is the actual gate; this is
       instant feedback, which is what coding-standards.md means by writing every
       rule twice. */
    const verstoss = pruefeAnlage(datei, art, anzahl)
    if (verstoss !== null) {
      fehler.push(meldung({ schluessel: verstoss.schluessel, werte: verstoss.werte }))
      continue
    }

    try {
      /* The protocol is brought into existence here rather than when the page
         opened. A protocol nobody typed into and nobody attached anything to
         never exists at all, which is the decision of 2026-09-10; attaching a
         photograph is putting something into it just as plainly as typing is.

         Inside the loop and inside the try, so a failure to create is reported
         against the file that was being added, with the same wording as a
         failure to upload. Asking again per file costs nothing: the answer is
         memoised after the first. */
      const id = await bereitstellen(entwurfId)
      angenommen.push(await ladeAnlageHoch({ entwurfId: id, art, datei }))
      anzahl += 1
    } catch (ursache) {
      fehler.push(meldung(fehlerMeldung(ursache, datei.name)))
    }
  }

  return { angenommen, fehler }
}

/* What came of trying to replace the single slot's file.
 *
 * 'stale' is the awkward one: the new file went up but the old one would not
 * come down, so the server now holds both and only a fresh read can say what the
 * screen should show. */
type ReplaceResult =
  | { status: 'replaced'; anlagen: Anlage[]; fehler: Meldung[] }
  | { status: 'rejected'; fehler: Meldung[] }
  | { status: 'stale'; fehler: Meldung[] }

/* The single slot's replace: the old file goes first, then the new one lands.
 *
 * **This ordering is the reverse of feature 10's, and the reverse was forced.**
 * That version stored the new file first precisely so that a refused replacement
 * could not destroy the map excerpt already there. On a server that is not
 * available: the database holds a unique index allowing one Kartenausschnitt per
 * protocol, so "new first" would be refused every single time there was
 * something to replace. Removing first is what reopens the slot.
 *
 * What that costs is exactly the case feature 10 was guarding: a replacement
 * that then fails leaves the slot empty rather than leaving the old picture
 * standing. Three things keep that from being a trap. The browser rules run
 * first, so the common refusals never reach here. The refusal says plainly that
 * nothing is attached now. And unlike feature 10's browser database, the file
 * that was removed is one the surveyor still has on their own machine.
 *
 * The browser rule is asked about a count of zero rather than the real one,
 * which is the honest question: the surveyor asked to replace, not to add a
 * second.
 */
async function ersetzeDatei(
  entwurfId: string,
  bereitstellen: Bereitsteller,
  art: Anlagenart,
  datei: File,
  alt: Anlage | undefined,
  meldung: MeldungFactory,
): Promise<ReplaceResult> {
  /* The old one first here, unlike feature 10, and this is the one ordering the
     move to a server changed. The database refuses a second Kartenausschnitt
     outright, so "new first" cannot work at all: it would be refused every time
     there was something to replace. Removing first reopens the slot.

     What that costs is the case feature 10 was protecting against: a refused
     replacement now leaves the slot empty. The refusal says so, and the browser
     rules run before any of this, so the common refusals never get this far. */
  if (alt !== undefined && !(await entferne(entwurfId, alt.id))) {
    return {
      status: 'stale',
      fehler: [
        meldung({
          schluessel: 'protokoll.anlagen.fehler.nichtEntfernt',
          werte: { dateiname: alt.dateiname },
        }),
      ],
    }
  }

  const { angenommen, fehler } = await sendeDateien(
    entwurfId,
    bereitstellen,
    art,
    [datei],
    0,
    meldung,
  )

  if (angenommen.length === 0) return { status: 'rejected', fehler }
  return { status: 'replaced', anlagen: angenommen, fehler }
}

async function entferne(entwurfId: string, anlageId: string): Promise<boolean> {
  try {
    await loescheAnlage(entwurfId, anlageId)
    return true
  } catch {
    return false
  }
}

export function useAnlagen(
  entwurfId: string,
  art: Anlagenart,
  bereitstellen: Bereitsteller,
  /* Told what the header should say about this block's work. The header speaks
     for the whole protocol, so an upload has to reach it; entwurf/speicherzustand.ts
     decides what it shows when the answers have something to say as well. */
  melde: (zustand: Anlagenzustand) => void,
): UseAnlagen {
  const [status, setStatus] = useState<AnlagenStatus>('loading')
  const [anlagen, setAnlagen] = useState<Anlage[]>([])
  const [meldungen, setMeldungen] = useState<Meldung[]>([])
  const [laeuft, setLaeuft] = useState(false)

  // Only ever counts up, so two identical refusals in one pick stay two rows.
  const meldungsId = useRef(0)
  const meldung = useCallback<MeldungFactory>((teile) => {
    meldungsId.current += 1
    return { id: meldungsId.current, ...teile }
  }, [])

  /* Reads the server and works out what the block should show, without touching
     state. Returning rather than setting is what lets the opening read throw a
     stale answer away: a slow first load can otherwise land after a fast second
     one and put the previous protocol's attachments on screen. */
  const lesen = useCallback(async () => {
    /* A protocol that has not been created has no attachments, and asking the
       server about the placeholder id would be a 404 shown as "we could not
       find out". Empty and loaded is both the truth and what the block should
       draw: the slot is free. */
    if (istNeu(entwurfId)) return { status: 'loaded' as const, anlagen: [] }

    try {
      const alle = await listeAnlagen(entwurfId)
      return {
        status: 'loaded' as const,
        // Already oldest first from the server. Each block shows its own kind.
        anlagen: alle.filter((anlage) => anlage.art === art),
      }
    } catch {
      /* Deliberately not an empty list. The section has to tell "nothing
         attached yet" from "we could not find out", since only one of those is
         worth a message and only one of them means the slot is free. */
      return { status: 'unavailable' as const, anlagen: [] }
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
      setLaeuft(true)
      melde({ status: 'saving' })
      try {
        const { angenommen, fehler } = await sendeDateien(
          entwurfId,
          bereitstellen,
          art,
          dateien,
          anlagen.length,
          meldung,
        )
        if (angenommen.length > 0) setAnlagen((bisher) => [...bisher, ...angenommen])
        setMeldungen(fehler)
        /* The server's own created_at, and the newest of the pick, so the header
           agrees with the record rather than with this browser's clock.

           Nothing is reported when every file was refused: the block is already
           naming each one and what to do about it, and the answers are perfectly
           safe, so the header has nothing to add. */
        melde(zuletztGespeichert(angenommen))
      } finally {
        setLaeuft(false)
      }
    },
    [anlagen.length, art, bereitstellen, entwurfId, melde, meldung],
  )

  const ersetzen = useCallback(
    async (datei: File) => {
      setLaeuft(true)
      melde({ status: 'saving' })
      try {
        const result = await ersetzeDatei(
          entwurfId,
          bereitstellen,
          art,
          datei,
          anlagen[0],
          meldung,
        )

        if (result.status === 'replaced') setAnlagen(result.anlagen)
        if (result.status === 'rejected') setAnlagen([])
        // The server may hold both, so the screen has to follow it rather than
        // what was intended.
        if (result.status === 'stale') anwenden(await lesen())
        setMeldungen(result.fehler)
        melde(result.status === 'replaced' ? zuletztGespeichert(result.anlagen) : null)
      } finally {
        setLaeuft(false)
      }
    },
    [anlagen, anwenden, art, bereitstellen, entwurfId, lesen, melde, meldung],
  )

  const entfernen = useCallback(
    async (id: string) => {
      const anlage = anlagen.find((eintrag) => eintrag.id === id)
      setLaeuft(true)
      melde({ status: 'saving' })

      try {
        /* A failed removal is not the same as not being able to read the list at
           all, even though both come out of a failed request. Treating it as the
           latter would blank the whole block over one file that is still
           perfectly there. */
        if (!(await entferne(entwurfId, id))) {
          setMeldungen([
            meldung({
              schluessel: 'protokoll.anlagen.fehler.nichtEntfernt',
              werte: { dateiname: anlage?.dateiname ?? '' },
            }),
          ])
          melde(null)
          return
        }

        setAnlagen((bisher) => bisher.filter((eintrag) => eintrag.id !== id))
        // A removal answers whatever the last pick complained about.
        setMeldungen([])
        /* The browser's clock, and the only place in this file that uses one.
           The delete endpoint answers 204 with no body, so there is no server
           timestamp to quote, and the round trip has just finished: the two are
           apart by the time of one request, which nothing reading "09:14" can
           tell. */
        melde({ status: 'saved', zeitpunkt: new Date().toISOString() })
      } finally {
        setLaeuft(false)
      }
    },
    [anlagen, entwurfId, melde, meldung],
  )

  return { status, anlagen, meldungen, laeuft, hinzufuegen, ersetzen, entfernen }
}
