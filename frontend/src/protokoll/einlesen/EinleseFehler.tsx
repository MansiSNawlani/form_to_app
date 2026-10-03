import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../../api/useFehlertext'

interface EinleseFehlerProps {
  fehler: unknown
  onSchliessen: () => void
}

/* The file could not be imported.
 *
 * The sentence is the server's refusal, through useFehlertext. Every refusal
 * this endpoint makes is written to this project's standard: it names the file,
 * says what is wrong in ordinary words, and says what to do instead. "Diese
 * Datei ist ein PDF-Formular, aber nicht das Protokoll E-Befischung. Meist ist es
 * das Protokoll Krebs" is worth more than anything a second wording here could
 * say. Since feature 17e it comes from fehler.server in the locale files, in the
 * chosen language, and backend/app/api/fehler_wortlaut_test.py keeps the German
 * there identical to the backend's.
 *
 * So there is no branching on the code, exactly as there is none for the
 * attachment refusals. A refusal added to the API after the locale files were
 * last written falls through to the backend's own German.
 *
 * The title is generic because that sentence already opens with the filename;
 * naming it here too read "«keine.pdf» konnte nicht eingelesen werden" directly
 * above "keine.pdf: Diese Datei konnte nicht geöffnet werden".
 */
function EinleseFehler({ fehler, onSchliessen }: EinleseFehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  return (
    <Alert severity="error" role="alert" className="einlesen__fehler">
      <AlertTitle>{t('protokolle.einlesen.fehler.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {fehlertext ?? t('protokolle.einlesen.fehler.text')}
      </Typography>
      <Button variant="outlined" size="small" onClick={onSchliessen}>
        {t('protokolle.einlesen.fehler.schliessen')}
      </Button>
    </Alert>
  )
}

export default EinleseFehler
