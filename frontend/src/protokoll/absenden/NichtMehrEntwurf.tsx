import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { statusAnzeige } from '../liste/anzeige'
import type { Status } from '../entwurf/typen'

interface NichtMehrEntwurfProps {
  status: Status
}

/* A protocol that has been sent, opened at its own form address.
 *
 * Reached the moment feature 11c gave anything a way out of DRAFT, and it has to
 * exist here rather than be left to fail later: without it the form opens as
 * usual, the automatic save starts, and the first keystroke is answered with a
 * conflict about a protocol nobody else has touched. Somebody would go looking
 * for a second tab that does not exist.
 *
 * No read-only rendering of the answers. Showing a submitted protocol is the
 * reviewer's screen, which is feature 11e, and half of one built here would be
 * the thing 11e then had to undo.
 */
function NichtMehrEntwurf({ status }: NichtMehrEntwurfProps) {
  const { t } = useTranslation()

  return (
    <Alert severity="info" className="protokoll-fehler">
      <AlertTitle>{t('protokoll.abgesendet.titel')}</AlertTitle>
      <Typography variant="body2" className="hinweis__text">
        {/* The status in the same words the list uses for it, so somebody moving
            between the two screens reads one vocabulary rather than two. */}
        {t('protokoll.abgesendet.text', { status: t(statusAnzeige(status).schluessel) })}
      </Typography>
      <Button component={Link} to="/protokolle" variant="outlined" size="small">
        {t('protokoll.abgesendet.zurUebersicht')}
      </Button>
    </Alert>
  )
}

export default NichtMehrEntwurf
