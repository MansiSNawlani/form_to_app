import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import NotFound from '../components/NotFound'
import ProtokollFormular from './ProtokollFormular'
import { abschnittPfad, findeAbschnitt } from './abschnitte'
import { entwurfsAbfrage } from './entwurf/abfragen'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN } from '../api/fehler'
import { useFehlertext } from '../api/useFehlertext'
import './protokoll.css'

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

  /* Reading was synchronous until feature 3b, when the draft moved to the
     server. It is a query rather than a loader because the failure has to be
     retryable from the page it happened on, and because the section links
     navigate between URLs that share this one document. */
  const { data: entwurf, isPending, error, refetch, isFetching } = useQuery(entwurfsAbfrage(id))
  const fehlertext = useFehlertext(error)
  const abschnitt = findeAbschnitt(nr)

  /* The route pattern always supplies an id, so this is a guard rather than a
     case anybody reaches. It matters because the query is disabled without one,
     and a disabled query stays pending forever: without this the page would sit
     on "wird geladen" and never move. */
  if (id === undefined) {
    return (
      <NotFound
        title={t('protokoll.nichtGefunden.titel')}
        text={t('protokoll.nichtGefunden.text')}
      />
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
    return (
      <NotFound
        title={t('protokoll.nichtGefunden.titel')}
        text={t('protokoll.nichtGefunden.text')}
      />
    )
  }

  /* Everything else: the backend is down, the network dropped, the session ran
     out. Nothing is wrong with the protocol itself, so this offers the way back
     in rather than claiming it is gone. */
  if (error !== null || entwurf === undefined) {
    return (
      <Alert severity="error" className="protokoll-fehler">
        <AlertTitle>{t('protokoll.ladefehler.titel')}</AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {fehlertext ?? t('protokoll.ladefehler.text')}
        </Typography>
        <Button variant="outlined" size="small" onClick={() => void refetch()} disabled={isFetching}>
          {t('protokoll.ladefehler.erneut')}
        </Button>
      </Alert>
    )
  }

  // The draft exists and only the section number is wrong, so send the user to
  // the first section rather than to a dead end. replace, so the bad URL does
  // not sit in the history waiting for the back button.
  if (abschnitt === undefined) {
    return <Navigate to={abschnittPfad(entwurf.id, 1)} replace />
  }

  /* Keyed by the draft, so opening a different protocol builds a fresh form
     rather than carrying the previous one's values into it. Switching drafts by
     URL keeps this component mounted; only the key forces the reset. */
  return <ProtokollFormular key={entwurf.id} entwurf={entwurf} abschnitt={abschnitt} />
}

export default ProtokollSeite
