import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../api/useFehlertext'

/* What /protokolle/neu shows when the protocol could not be started.
 *
 * That route is a loader rather than a component on purpose: loaders run once
 * per navigation, while an effect under StrictMode runs twice and would leave a
 * stray empty protocol on the server every time. A loader has nothing to render,
 * so its failure needs this, which React Router reaches through errorElement.
 *
 * Retrying is a link back to the same address rather than a button that calls
 * again, so the whole loader runs afresh, session check included: by the time
 * somebody reads this and tries again their session may itself have run out.
 */
function ProtokollAnlegenFehler() {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(useRouteError())

  return (
    <Alert severity="error" className="protokoll-fehler">
      <AlertTitle>{t('protokoll.anlegen.fehlerTitel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('protokoll.anlegen.fehlerText')}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button component={Link} to="/protokolle/neu" variant="contained" size="small">
          {t('protokoll.anlegen.erneut')}
        </Button>
        <Button component={Link} to="/" variant="outlined" size="small">
          {t('protokoll.kopf.alleProtokolle')}
        </Button>
      </Stack>
    </Alert>
  )
}

export default ProtokollAnlegenFehler
