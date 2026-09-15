import Typography from '@mui/material/Typography'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import NichtMehrEntwurf from './absenden/NichtMehrEntwurf'
import AenderungAngefordert from './pruefung/AenderungAngefordert'
import ProtokollFormular from './ProtokollFormular'
import ProtokollLadefehler from './ProtokollLadefehler'
import ProtokollNichtGefunden from './ProtokollNichtGefunden'
import { abschnittPfad, findeAbschnitt } from './abschnitte'
import VerwerfenDialog from './VerwerfenDialog'
import { entwurfsAbfrage, entwurfsKey } from './entwurf/abfragen'
import { NEU, istNeu, leererEntwurf, verlaesstProtokoll } from './entwurf/neu'
import type { Entwurf, Status } from './entwurf/typen'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN } from '../api/fehler'
import './protokoll.css'

/* The states whose owner may still fill the form in, mirroring AENDERBAR in
   backend/app/protokolle/regeln.py. NEEDS_CHANGES joined DRAFT in feature 11d,
   and the server is the authority: this list only decides whether the form is
   drawn, while every save is checked again there. */
const AENDERBAR: readonly Status[] = ['DRAFT', 'NEEDS_CHANGES']

/* Resolves the URL into a draft and a section, and nothing else. The form
 * itself is a separate component so that this one can decide the dead-end cases
 * before any form state exists.
 *
 * The draft id and the section both come from the URL, so a section is
 * deep-linkable and the browser's own back button moves between sections
 * without any history handling of our own. */
function ProtokollSeite() {
  const { id, nr } = useParams()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  /* Whether this visit began at /protokolle/neu, decided once and never again.
   *
   * It has to be sticky. The moment the first thing is typed, the record is
   * created and the address swaps to the real id, so reading istNeu(id) on
   * every render would flip this page onto the fetching path mid-keystroke,
   * rebuild the form from the server's copy and take the cursor with it. The
   * whole point of routing both addresses through one route is that nothing is
   * torn down when the id appears. */
  const [begannNeu] = useState(() => istNeu(id))

  /* One stand-in for the life of this page, so the automatic save is handed the
     same object throughout and its subscription is never rebuilt. */
  const [neuerEntwurf] = useState(leererEntwurf)

  /* A ref as well as state, because the blocker below is consulted during the
     very navigation that sets it. State would still read false at that moment
     and the page would block its own address swap. */
  const angelegt = useRef(false)
  const [, setAngelegt] = useState(false)

  // The section the person is actually on when the record gets created, which
  // is not always the one they started on: the effect that owns the callback
  // never re-runs, so it would otherwise close over the first section forever.
  const aktuelleNr = useRef(nr)
  useEffect(() => {
    aktuelleNr.current = nr
  }, [nr])

  const beiAnlage = useCallback(
    (entwurf: Entwurf) => {
      angelegt.current = true
      setAngelegt(true)

      /* Straight into the cache the protocol page reads, so the address swap
         below renders the draft we are holding instead of asking the server for
         a document we just wrote. */
      queryClient.setQueryData(entwurfsKey(entwurf.id), entwurf)

      /* replace, so the back button goes where the surveyor came from rather
         than to /protokolle/neu, which would start a second empty protocol. */
      void navigate(abschnittPfad(entwurf.id, Number(aktuelleNr.current) || 1), {
        replace: true,
      })
    },
    [navigate, queryClient],
  )

  /* Asks before leaving a protocol that was never created. Section changes are
     not leaving, which is what verlaesstProtokoll decides. */
  const blocker = useBlocker(
    ({ nextLocation }) =>
      begannNeu && !angelegt.current && verlaesstProtokoll(nextLocation.pathname),
  )

  /* Reading was synchronous until feature 3b, when the draft moved to the
     server. It is a query rather than a loader because the failure has to be
     retryable from the page it happened on, and because the section links
     navigate between URLs that share this one document. */
  const {
    data: entwurf,
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery(entwurfsAbfrage(begannNeu ? undefined : id))
  const abschnitt = findeAbschnitt(nr)

  /* The route pattern always supplies an id, so this is a guard rather than a
     case anybody reaches. It matters because the query is disabled without one,
     and a disabled query stays pending forever: without this the page would sit
     on "wird geladen" and never move. */
  if (id === undefined) {
    return <ProtokollNichtGefunden />
  }

  if (begannNeu) {
    if (abschnitt === undefined) return <Navigate to={abschnittPfad(NEU, 1)} replace />

    return (
      <>
        <ProtokollFormular
          key={NEU}
          entwurf={neuerEntwurf}
          abschnitt={abschnitt}
          onAngelegt={beiAnlage}
        />
        <VerwerfenDialog
          offen={blocker.state === 'blocked'}
          onBleiben={() => blocker.reset?.()}
          onVerwerfen={() => blocker.proceed?.()}
        />
      </>
    )
  }

  if (isPending) {
    /* A live region, so somebody using a screen reader is told the page is
       working rather than left on a heading that never changes. */
    return (
      <Typography variant="body1" role="status">
        {t('protokoll.laedt')}
      </Typography>
    )
  }

  /* No such protocol, or somebody else's. The backend deliberately answers the
     same way to both, so that a stranger cannot discover which ids exist, and
     this must not be softened into "you have no permission". */
  if (error instanceof ApiFehler && error.code === PROTOKOLL_NICHT_GEFUNDEN) {
    return <ProtokollNichtGefunden />
  }

  /* Everything else: the backend is down, the network dropped, the session ran
     out. Nothing is wrong with the protocol itself, so this offers the way back
     in rather than claiming it is gone. */
  if (error !== null || entwurf === undefined) {
    return (
      <ProtokollLadefehler fehler={error} laeuft={isFetching} onErneut={() => void refetch()} />
    )
  }

  /* Sent already, so there is nothing here to fill in.
   *
   * NEEDS_CHANGES is the exception, added in feature 11d: a reviewer has asked
   * for a correction, and a protocol that cannot be corrected makes the request
   * pointless. It opens in the form exactly as a draft does, with what was asked
   * for printed above it.
   *
   * Before the section check below, because a submitted protocol is not editable
   * whichever section the URL names, and redirecting it to section 1 first would
   * only put a wrong address in the history on the way to the same notice.
   */
  if (!AENDERBAR.includes(entwurf.status)) {
    return <NichtMehrEntwurf status={entwurf.status} />
  }

  // The draft exists and only the section number is wrong, so send the user to
  // the first section rather than to a dead end. replace, so the bad URL does
  // not sit in the history waiting for the back button.
  if (abschnitt === undefined) {
    return <Navigate to={abschnittPfad(entwurf.id, 1)} replace />
  }

  /* Keyed by the draft, so opening a different protocol builds a fresh form
     rather than carrying the previous one's values into it. Switching drafts by
     URL keeps this component mounted; only the key forces the reset.

     The change request sits outside the form and above it, so it survives moving
     between sections the way the problem list does: the correction it asks for is
     rarely in the section the surveyor happens to land on. */
  return (
    <>
      {entwurf.status === 'NEEDS_CHANGES' && <AenderungAngefordert entwurfId={entwurf.id} />}
      <ProtokollFormular key={entwurf.id} entwurf={entwurf} abschnitt={abschnitt} />
    </>
  )
}

export default ProtokollSeite
