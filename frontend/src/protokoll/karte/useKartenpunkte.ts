import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import type { Antworten } from '../entwurf/typen'
import { EINGERASTET, GESETZT } from './einrasten'
import type { Grenze } from './Grenzwahl'
import { zuKartenpunkt, type Kartenpunkt } from './umrechnung'

const PFADE = [
  GESETZT.unten.rw,
  GESETZT.unten.hw,
  EINGERASTET.unten.rw.pfad,
  EINGERASTET.unten.hw.pfad,
  GESETZT.oben.rw,
  GESETZT.oben.hw,
  EINGERASTET.oben.rw.pfad,
  EINGERASTET.oben.hw.pfad,
] as const

export interface Kartenpunkte {
  gesetzt: Kartenpunkt | null
  amWasser: Kartenpunkt | null
}

/* Where each boundary is on the map: the typed point, and its position on the
   water unless that is being asked for again (unsicher), in which case it may
   still belong to where the point was before it moved. */
export function useKartenpunkte(
  unsicher: Readonly<Record<Grenze, boolean>>,
): Readonly<Record<Grenze, Kartenpunkte>> {
  const [rwU, hwU, wRwU, wHwU, rwO, hwO, wRwO, wHwO] = useWatch<Antworten>({
    name: PFADE,
  }) as readonly (string | undefined)[]

  const unten = useMemo(
    () => ({
      gesetzt: zuKartenpunkt(rwU, hwU),
      amWasser: unsicher.unten ? null : zuKartenpunkt(wRwU, wHwU),
    }),
    [rwU, hwU, wRwU, wHwU, unsicher.unten],
  )
  const oben = useMemo(
    () => ({
      gesetzt: zuKartenpunkt(rwO, hwO),
      amWasser: unsicher.oben ? null : zuKartenpunkt(wRwO, wHwO),
    }),
    [rwO, hwO, wRwO, wHwO, unsicher.oben],
  )
  return useMemo(() => ({ unten, oben }), [unten, oben])
}
