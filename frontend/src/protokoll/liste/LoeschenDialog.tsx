import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useTranslation } from 'react-i18next'
import { titelAusTeilen } from '../entwurf/titel'
import type { Uebersicht } from '../entwurf/typen'

interface LoeschenDialogProps {
  /** The protocol awaiting confirmation, or null when none is. */
  zeile: Uebersicht | null
  laeuft: boolean
  onAbbrechen: () => void
  onBestaetigen: () => void
}

/* Asks before a draft goes.
 *
 * Deleting is the one action on this page that cannot be taken back. The
 * protocol leaves the server, and its safety copy and attachments leave this
 * browser with it, so there is nothing left to restore it from.
 *
 * The protocol is named in the question rather than left as "dieses Protokoll",
 * for the same reason attachments are named in theirs: a list of drafts on the
 * same water looks much alike, and the name is the only thing telling somebody
 * they are about to delete the wrong one.
 */
function LoeschenDialog({ zeile, laeuft, onAbbrechen, onBestaetigen }: LoeschenDialogProps) {
  const { t } = useTranslation()

  const name =
    zeile === null
      ? ''
      : (titelAusTeilen(zeile.gewaessername ?? undefined, zeile.ortsangabe ?? undefined) ??
        t('protokolle.list.ohneGewaesser'))

  return (
    <Dialog open={zeile !== null} onClose={onAbbrechen}>
      <DialogTitle>{t('protokolle.list.loeschen.titel')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('protokolle.list.loeschen.text', { name })}</DialogContentText>
      </DialogContent>
      <DialogActions>
        {/* Cancel first and focused by default, so the destructive button is
            never what a hurried Enter lands on. */}
        <Button variant="outlined" autoFocus onClick={onAbbrechen} disabled={laeuft}>
          {t('protokolle.list.loeschen.abbrechen')}
        </Button>
        <Button variant="contained" color="error" onClick={onBestaetigen} disabled={laeuft}>
          {t('protokolle.list.loeschen.bestaetigen')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default LoeschenDialog
