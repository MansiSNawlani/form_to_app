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
 * The sentence is the backend's own. Every refusal this endpoint makes arrives
 * with German written to this project's standard: it names the file, says what
 * is wrong in ordinary words, and says what to do instead. "Diese Datei ist ein
 * PDF-Formular, aber nicht das Protokoll E-Befischung. Meist ist es das
 * Protokoll Krebs" is worth more than anything a second wording here could say,
 * and writing one would leave two Germans to drift apart.
 *
 * So there is no branching on the code, exactly as there is none for the
 * attachment refusals: not a PDF, locked with a password, no form in it, not
 * this form, no version stamp, too big. useFehlertext falls through to the
 * backend's sentence for any code we have no wording of our own for, which also
 * covers a refusal added to the API after this file was last read.
 *
 * The title is deliberately generic, and the file is named once rather than
 * twice. Every one of these refusals arrives with the filename already at the
 * front of the backend's own sentence, so a title repeating it read "«keine.pdf»
 * konnte nicht eingelesen werden" directly above "keine.pdf: Diese Datei konnte
 * nicht geöffnet werden". Found by looking at the screen on 2026-09-23. One
 * name, in the sentence that was written to carry it, which is also how
 * liste/Ladefehler.tsx composes its own.
 *
 * Nothing about the list moves. A refused import leaves the page, the table and
 * the scroll position exactly where they were, because nothing happened to the
 * protocols: one file was not read.
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
