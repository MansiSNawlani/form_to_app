import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { Antworten, AntwortPfad } from '../entwurf/typen'
import { KENNUNG_PFAD, NAME_PFAD, VERSION_PFAD } from '../gewaessernetz/auswahl'
import type { Punkt } from '../gewaessernetz/api'
import {
  einrastenAbfrage,
  einrastenSchreibt,
  gewaehltAus,
  nurGeaenderte,
  type Punktstand,
} from './einrasten'
import type { Grenze } from './Grenzwahl'
import { gueltigerPunkt } from './umrechnung'

const BEOBACHTET = [
  'probestrecke.utm_rw_unten',
  'probestrecke.utm_hw_unten',
  'probestrecke.utm_rw_oben',
  'probestrecke.utm_hw_oben',
  KENNUNG_PFAD,
  NAME_PFAD,
  VERSION_PFAD,
] as const satisfies readonly AntwortPfad[]

/* Keeps the snapped answers in the draft current while the surveyor edits.

   Asks once per valid point, again whenever the point or the picked water
   changes, and writes only what differs, so opening a draft whose answers are
   already current leaves it unchanged. Off on the read-only screens, where the
   stored answers are what is shown.

   Answers which points are unsicher: asked about and not yet answered, or
   failed. Their stored position may belong to where the point was before it
   moved, so the map and the panel leave them out until the answer arrives. */
export function useEinrasten(aktiv: boolean): Readonly<Record<Grenze, boolean>> {
  const { getValues, setValue } = useFormContext<Antworten>()
  const [rwUnten, hwUnten, rwOben, hwOben, kennung, name, version] = useWatch<Antworten>({
    name: BEOBACHTET,
  }) as readonly (string | undefined)[]

  const unten = useMemo(() => gueltigerPunkt(rwUnten, hwUnten), [rwUnten, hwUnten])
  const oben = useMemo(() => gueltigerPunkt(rwOben, hwOben), [rwOben, hwOben])
  const gewaehlt = useMemo(() => gewaehltAus(kennung, name, version), [kennung, name, version])

  const abfrageUnten = useQuery(einrastenAbfrage(aktiv ? unten : null, gewaehlt))
  const abfrageOben = useQuery(einrastenAbfrage(aktiv ? oben : null, gewaehlt))

  const standUnten = punktstand(unten, abfrageUnten.data, abfrageUnten.isSuccess)
  const standOben = punktstand(oben, abfrageOben.data, abfrageOben.isSuccess)

  useEffect(() => {
    if (!aktiv) return
    const eintraege = nurGeaenderte(
      einrastenSchreibt({ unten: standUnten, oben: standOben }),
      (pfad) => getValues(pfad),
    )
    for (const [pfad, wert] of eintraege) setValue(pfad, wert, { shouldDirty: true })
  }, [aktiv, standUnten, standOben, getValues, setValue])

  const untenUnsicher = aktiv && standUnten === undefined
  const obenUnsicher = aktiv && standOben === undefined
  // One object per change rather than per render, since the map's effect lists it.
  return useMemo(
    () => ({ unten: untenUnsicher, oben: obenUnsicher }),
    [untenUnsicher, obenUnsicher],
  )
}

function punktstand(
  punkt: Punkt | null,
  antwort: Punktstand,
  erfolgreich: boolean,
): Punktstand {
  if (punkt === null) return 'leer'
  return erfolgreich ? antwort : undefined
}
