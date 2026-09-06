import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { AnlagenStatus } from '../../anlagen/useAnlagen'

interface AnlagenZustandProps {
  status: AnlagenStatus
}

/* What a block shows instead of its contents while there are no contents to
 * show.
 *
 * Reading attachments is asynchronous, unlike reading a draft, so there is a
 * real moment before the answer arrives. A blank area during it reads as "this
 * protocol has no attachments", which is a different and wrong statement.
 *
 * The unavailable case is not the surveyor's mistake and must not be worded as
 * though it were. It reuses the message the picker would have shown, because
 * the situation is identical: this browser will not store anything at all.
 */
function AnlagenZustand({ status }: AnlagenZustandProps) {
  const { t } = useTranslation()

  if (status === 'laedt') {
    return (
      // Polite rather than assertive: a fast disk answers before anyone has
      // finished reading this, and interrupting for that would be noise.
      <Typography variant="body2" color="text.secondary" role="status">
        {t('protokoll.abschnitt7.laedt')}
      </Typography>
    )
  }

  if (status === 'nicht_verfuegbar') {
    return (
      <Alert severity="error">
        {t('protokoll.anlagen.fehler.speicherNichtVerfuegbar')}
      </Alert>
    )
  }

  return null
}

export default AnlagenZustand
