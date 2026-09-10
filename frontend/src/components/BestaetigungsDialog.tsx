import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import type { ReactNode } from 'react'

interface BestaetigungsDialogProps {
  /** Open exactly when there is something to ask about. */
  offen: boolean
  titel: string
  /** The question. It names the thing, which is the point of asking. */
  text: ReactNode
  abbrechenLabel: string
  bestaetigenLabel: string
  /** Disables both buttons while the request is in flight. */
  laeuft?: boolean
  /* Red by default, because the usual reason to ask is that something is about
     to be destroyed. 'primary' is for the case where the answer costs nothing,
     such as leaving a protocol that was never created, where a red button would
     make an empty page look like a hazard. */
  bestaetigenFarbe?: 'error' | 'primary'
  onAbbrechen: () => void
  onBestaetigen: () => void
}

/* Asks before something that cannot be taken back.
 *
 * One component, because there are now two of these and they were identical
 * apart from their words: feature 10 asks before an attachment is removed, and
 * feature 3c asks before a draft is deleted. The button order and the focus are
 * the part worth having in one place rather than the markup, since getting them
 * wrong is what turns a confirmation into a formality.
 *
 * Cancel comes first and takes focus, so the destructive button is never what a
 * hurried Enter lands on. The caller names the thing in the question: a list of
 * drafts on the same water, or twenty photograph tiles, look much alike, and the
 * name is the only thing telling somebody they are about to lose the wrong one.
 */
function BestaetigungsDialog({
  offen,
  titel,
  text,
  abbrechenLabel,
  bestaetigenLabel,
  laeuft = false,
  bestaetigenFarbe = 'error',
  onAbbrechen,
  onBestaetigen,
}: BestaetigungsDialogProps) {
  return (
    <Dialog open={offen} onClose={onAbbrechen}>
      <DialogTitle>{titel}</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" autoFocus onClick={onAbbrechen} disabled={laeuft}>
          {abbrechenLabel}
        </Button>
        <Button
          variant="contained"
          color={bestaetigenFarbe}
          onClick={onBestaetigen}
          disabled={laeuft}
        >
          {bestaetigenLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default BestaetigungsDialog
