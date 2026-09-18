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

/* The queue could not be fetched.
 *
 * Shown only when there is nothing to show instead. This list refetches freely,
 * so a background refetch can fail while perfectly good rows are on screen, and
 * saying the queue could not be loaded above a table of it is both alarming and
 * untrue. The page decides that; this only says it.
 *
 * The same shape as liste/Ladefehler.tsx and deliberately a separate component:
 * the wording is different, because what a reviewer fears on seeing this is not
 * what a surveyor fears, and this feature does not reach into Meine Protokolle's
 * components to add a prop to them.
 *
 * A refusal for the wrong role never arrives here. That is KeineBerechtigung's,
 * because it is settled rather than worth retrying.
 */
function Ladefehler({ fehler, laeuft, onErneut }: LadefehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  return (
    <Alert severity="error">
      <AlertTitle>{t('pruefliste.ladefehler.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('pruefliste.ladefehler.text')}
      </Typography>
      <Button variant="outlined" size="small" onClick={onErneut} disabled={laeuft}>
        {t('pruefliste.ladefehler.erneut')}
      </Button>
    </Alert>
  )
}

export default Ladefehler
