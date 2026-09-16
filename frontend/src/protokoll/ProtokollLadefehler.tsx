import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../api/useFehlertext'

interface ProtokollLadefehlerProps {
  fehler: unknown
  /** Whether a retry is already in flight, so the button cannot be pressed twice. */
  laeuft: boolean
  onErneut: () => void
}

/* One protocol could not be fetched.
 *
 * The backend is down, the network dropped, or the session ran out. Nothing is
 * wrong with the protocol itself, which is why this offers the way back in
 * rather than claiming it is gone, and why the message says the stored answers
 * are unaffected: the thing somebody fears on seeing this is that their work has
 * been lost.
 *
 * Shared by the form's page and the reviewer's, which reach it by the same route
 * and have to say the same thing. liste/Ladefehler.tsx is its counterpart for
 * the list, and stays separate because it speaks about a list of protocols
 * rather than about one.
 */
function ProtokollLadefehler({ fehler, laeuft, onErneut }: ProtokollLadefehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  return (
    <Alert severity="error" className="protokoll-fehler">
      <AlertTitle>{t('protokoll.ladefehler.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('protokoll.ladefehler.text')}
      </Typography>
      <Button variant="outlined" size="small" onClick={onErneut} disabled={laeuft}>
        {t('protokoll.ladefehler.erneut')}
      </Button>
    </Alert>
  )
}

export default ProtokollLadefehler
