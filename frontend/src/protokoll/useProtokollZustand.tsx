import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ProtokollLadefehler from './ProtokollLadefehler'
import ProtokollNichtGefunden from './ProtokollNichtGefunden'
import { entwurfsAbfrage } from './entwurf/abfragen'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN } from '../api/fehler'
import type { Entwurf } from './entwurf/typen'

/* Fetching one protocol, and everything that can happen instead.
 *
 * Both pages that open a protocol by id reach the same four dead ends before
 * they reach a protocol, and until the branch review on 2026-09-15 they each
 * held their own copy of all four, comments included. The leaf messages were
 * shared; the cascade in front of them was not.
 *
 * It hands back a ReactNode rather than a discriminated union the caller
 * switches on, because there is nothing to decide: every one of these states has
 * exactly one right rendering and both callers want it. A caller does
 *
 *     if (zustand !== null) return zustand
 *
 * and everything after that line has a protocol.
 */
interface Protokollzustand {
  /** What to render instead of the protocol, or nothing when there is one. */
  zustand: ReactNode | null
  /** Present exactly when zustand is null. */
  protokoll: Entwurf | undefined
}

export function useProtokollZustand(id: string | undefined): Protokollzustand {
  const { t } = useTranslation()
  const {
    data: protokoll,
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery(entwurfsAbfrage(id))

  /* The route pattern always supplies an id, so this is a guard rather than a
     case anybody reaches. It matters because the query is disabled without one
     and a disabled query stays pending forever, which would leave a page on
     "wird geladen" and never move. */
  if (id === undefined) {
    return { zustand: <ProtokollNichtGefunden />, protokoll: undefined }
  }

  if (isPending) {
    /* A live region, so somebody using a screen reader is told the page is
       working rather than left on a heading that never changes. */
    return {
      zustand: (
        <Typography variant="body1" role="status">
          {t('protokoll.laedt')}
        </Typography>
      ),
      protokoll: undefined,
    }
  }

  /* No such protocol, or one this account may not see. The backend answers the
     two identically on purpose, so a stranger cannot discover which ids are
     real, and **this must never be softened into "you have no permission"**:
     that sentence is itself the fact being withheld. */
  if (error instanceof ApiFehler && error.code === PROTOKOLL_NICHT_GEFUNDEN) {
    return { zustand: <ProtokollNichtGefunden />, protokoll: undefined }
  }

  /* Everything else: the backend is down, the network dropped, the session ran
     out. Nothing is wrong with the protocol itself, so this offers the way back
     in rather than claiming it is gone. */
  if (error !== null || protokoll === undefined) {
    return {
      zustand: (
        <ProtokollLadefehler
          fehler={error}
          laeuft={isFetching}
          onErneut={() => void refetch()}
        />
      ),
      protokoll: undefined,
    }
  }

  return { zustand: null, protokoll }
}
