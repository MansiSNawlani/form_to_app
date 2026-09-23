import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../../api/useFehlertext'
import { useHerunterladen } from './useHerunterladen'

interface HerunterladenKnopfProps {
  protokollId: string
}

/* Save this protocol as a PDF.
 *
 * On both heads: the form a surveyor is still filling in and the view of one
 * that has been filed. The endpoint answers for any status, and a copy of an
 * unfinished protocol is a reasonable thing to want; the document prints the
 * status on every page, so a draft cannot be mistaken for a filed one.
 *
 * The refusal goes in a Snackbar rather than beside the button. There is no
 * field this is about and nothing on the page to correct, so the message has
 * nowhere of its own to sit, and the two heads it appears in are both a row of
 * small controls with no room for a paragraph. The sentence is still the
 * backend's own, through useFehlertext, like every other refusal here.
 */
function HerunterladenKnopf({ protokollId }: HerunterladenKnopfProps) {
  const { t } = useTranslation()
  const { herunterladen, verwerfen, laeuft, fehler } = useHerunterladen(protokollId)
  const fehlertext = useFehlertext(fehler)

  return (
    <>
      <Button
        type="button"
        size="small"
        variant="outlined"
        onClick={herunterladen}
        disabled={laeuft}
        /* Named for what it does rather than for the file format. "PDF" alone
           is what the button shows on a narrow head, and a screen reader
           reading "PDF" out of a row of buttons says nothing at all. */
        aria-label={t('protokoll.ausgabe.knopf')}
      >
        {laeuft ? t('protokoll.ausgabe.laeuft') : t('protokoll.ausgabe.knopf')}
      </Button>

      <Snackbar
        open={fehlertext !== undefined}
        onClose={verwerfen}
        autoHideDuration={10000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" role="alert" onClose={verwerfen} variant="filled">
          {fehlertext ?? t('protokoll.ausgabe.fehler')}
        </Alert>
      </Snackbar>
    </>
  )
}

export default HerunterladenKnopf
