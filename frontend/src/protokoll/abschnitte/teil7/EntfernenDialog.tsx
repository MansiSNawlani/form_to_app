import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useTranslation } from 'react-i18next'

interface EntfernenDialogProps {
  /** The attachment awaiting confirmation, or null when nothing is. */
  dateiname: string | null
  onAbbrechen: () => void
  onBestaetigen: () => void
}

/* Asks before an attachment goes.
 *
 * Removing is the one action here that cannot be taken back: the file lives
 * only in this browser, so there is nothing to restore it from and no undo to
 * offer. Replacing does not ask, because the button says what it does and the
 * picker that opens is itself a second chance.
 *
 * The file is named in the question rather than left as "dieses Foto", for the
 * same reason every refusal names it: twenty tiles look much alike.
 */
function EntfernenDialog({
  dateiname,
  onAbbrechen,
  onBestaetigen,
}: EntfernenDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={dateiname !== null} onClose={onAbbrechen}>
      <DialogTitle>{t('protokoll.abschnitt7.entfernenFrage.titel')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('protokoll.abschnitt7.entfernenFrage.text', {
            dateiname: dateiname ?? '',
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {/* Cancel first and focused by default, so the destructive button is
            never what a hurried Enter lands on. */}
        <Button variant="outlined" autoFocus onClick={onAbbrechen}>
          {t('protokoll.abschnitt7.entfernenFrage.abbrechen')}
        </Button>
        <Button variant="contained" color="error" onClick={onBestaetigen}>
          {t('protokoll.abschnitt7.entfernenFrage.bestaetigen')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EntfernenDialog
