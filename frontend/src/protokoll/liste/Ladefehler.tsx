import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../../api/useFehlertext'

interface LadefehlerProps {
  fehler: unknown
  laeuft: boolean
  onErneut: () => void
}

/* The list could not be fetched.
 *
 * Shown only when there is nothing to show instead. The list may be refetched
 * freely, so a background refetch can fail while perfectly good rows are on
 * screen, and telling somebody their protocols could not be loaded above a table
 * of their protocols is both alarming and untrue. The page decides that; this
 * only says it.
 *
 * It says the protocols are safe, because the thing somebody fears on seeing
 * this is that their work is gone. Nothing here is unsaved: everything the list
 * shows was last written by the server.
 */
function Ladefehler({ fehler, laeuft, onErneut }: LadefehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  return (
    <Alert severity="error">
      <AlertTitle>{t('protokolle.list.ladefehler.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('protokolle.list.ladefehler.text')}
      </Typography>
      <Button variant="outlined" size="small" onClick={onErneut} disabled={laeuft}>
        {t('protokolle.list.ladefehler.erneut')}
      </Button>
    </Alert>
  )
}

export default Ladefehler
