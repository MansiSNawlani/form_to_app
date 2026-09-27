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
  /* What could not be loaded. Defaults to the list, which is what this was built
     for; feature 16d's page passes its own, because "Die Konten konnten nicht
     geladen werden" over a single account would be telling the reader about
     something they did not ask for. */
  titel?: string
}

/* The account list could not be fetched.
 *
 * Shown only when there is nothing to show instead. A background refetch can fail
 * while perfectly good rows are on screen, and saying the list could not be loaded
 * above a table of it is both alarming and untrue. The page decides that; this only
 * says it.
 *
 * A refusal for the wrong role never arrives here. That is KeineBerechtigung's,
 * because it is settled rather than worth retrying.
 */
function Ladefehler({ fehler, laeuft, onErneut, titel }: LadefehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  return (
    <Alert severity="error">
      <AlertTitle>{titel ?? t('benutzerverwaltung.ladefehler.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('benutzerverwaltung.ladefehler.text')}
      </Typography>
      <Button variant="outlined" size="small" onClick={onErneut} disabled={laeuft}>
        {t('benutzerverwaltung.ladefehler.erneut')}
      </Button>
    </Alert>
  )
}

export default Ladefehler
