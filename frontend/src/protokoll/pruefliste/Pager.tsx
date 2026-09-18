import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

interface PagerProps {
  seite: number
  seiten: number
  onSeite: (seite: number) => void
}

/* Which page of the queue is showing, and the way to the next and the previous.
 *
 * Two buttons and a sentence rather than a numbered pager. MUI's Pagination lives
 * in a separate package this project does not have, and coding-standards.md says
 * "it lives in MUI X" does not count as MUI having the component. Three elements
 * is also all this needs: a work queue is read front to back, not jumped around.
 *
 * A nav with a name, because a screen reader otherwise announces two unlabelled
 * buttons with no indication of what they page through.
 *
 * seiten is never below 1, which the endpoint guarantees, so an empty queue reads
 * "Seite 1 von 1" rather than "Seite 1 von 0".
 */
function Pager({ seite, seiten, onSeite }: PagerProps) {
  const { t } = useTranslation()

  return (
    <nav className="pager" aria-label={t('pruefliste.pager.beschriftung')}>
      <Button
        size="small"
        variant="outlined"
        disabled={seite <= 1}
        onClick={() => onSeite(seite - 1)}
      >
        {t('pruefliste.pager.zurueck')}
      </Button>

      {/* A live region: paging replaces the rows without moving focus, so
          somebody using a screen reader would otherwise get no confirmation that
          the button did anything. */}
      <Typography variant="body2" className="pager__stand" role="status">
        {t('pruefliste.pager.stand', { seite, seiten })}
      </Typography>

      {/* Held open past the last page when the address bar asked for one beyond
          the end: the endpoint answers that with an empty page and the true
          total, so Zurueck above is the way back rather than a dead end. */}
      <Button
        size="small"
        variant="outlined"
        disabled={seite >= seiten}
        onClick={() => onSeite(seite + 1)}
      >
        {t('pruefliste.pager.weiter')}
      </Button>
    </nav>
  )
}

export default Pager
