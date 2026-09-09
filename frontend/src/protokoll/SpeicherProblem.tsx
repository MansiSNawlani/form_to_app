import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { SaveState } from './entwurf/useAutoSave'

/* What a save failure actually means, with room to say it.
 *
 * The indicator beside the heading is a few words in a tight row, and it appears
 * twice on the page: it can say that something is wrong, but not why or what to
 * do about it. This is the other half. It appears only when a save has failed,
 * so an ordinary session never sees it at all.
 *
 * The two cases are genuinely different and must not share wording. A save that
 * did not arrive will probably arrive next time and nothing is required of the
 * person. A conflict will never arrive, because the same request would be
 * refused again, and only the person can decide what to do.
 */
function SpeicherProblem({ saveState }: { saveState: SaveState }) {
  const { t } = useTranslation()

  if (saveState.status !== 'failed' && saveState.status !== 'konflikt') return null

  const konflikt = saveState.status === 'konflikt'

  return (
    <Alert severity={konflikt ? 'error' : 'warning'} className="protokoll-speicherproblem">
      <AlertTitle>
        {konflikt
          ? t('protokoll.speichern.problem.konfliktTitel')
          : t('protokoll.speichern.problem.fehlerTitel')}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: konflikt ? 2 : 0 }}>
        {konflikt
          ? t('protokoll.speichern.problem.konfliktText')
          : t('protokoll.speichern.problem.fehlerText')}
      </Typography>
      {/* Only the conflict gets an action. Reloading is the way out of it, and
          the safety copy is what makes that safe: the reload offers back exactly
          what is on screen now. Offering it for an ordinary failure would invite
          somebody to reload while the copy is the only place their work is. */}
      {konflikt && (
        <Button variant="contained" size="small" onClick={() => window.location.reload()}>
          {t('protokoll.speichern.problem.neuLaden')}
        </Button>
      )}
    </Alert>
  )
}

export default SpeicherProblem
