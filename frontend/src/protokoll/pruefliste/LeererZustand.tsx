import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

interface LeererZustandProps {
  /** True when filters are set, so the emptiness is this selection's and not the queue's. */
  gefiltert: boolean
  onZuruecksetzen: () => void
}

/* Nothing to show, and which of the two reasons it is.
 *
 * The distinction is the whole point of this component. "Nothing has been handed
 * in yet" and "nothing matches what you asked for" look identical on screen and
 * need opposite responses: the first is waiting, the second is a filter to undo.
 * Telling somebody the queue is empty when they have quietly narrowed it to one
 * year and one Anlass sends them looking for a fault that is not there.
 *
 * Only the filtered case offers a way out, because there is nothing to reset in
 * the other one and a button that does nothing is worse than no button.
 *
 * Shown only for a page that loaded and came back empty. A failed request is a
 * different thing and says so.
 */
function LeererZustand({ gefiltert, onZuruecksetzen }: LeererZustandProps) {
  const { t } = useTranslation()
  const bereich = gefiltert ? 'keineTreffer' : 'leer'

  return (
    <div className="empty">
      <Typography variant="h2">{t(`pruefliste.${bereich}.titel`)}</Typography>
      <Typography variant="body1">{t(`pruefliste.${bereich}.text`)}</Typography>
      {gefiltert && (
        <Button variant="outlined" className="empty__aktion" onClick={onZuruecksetzen}>
          {t('pruefliste.filter.zuruecksetzen')}
        </Button>
      )}
    </div>
  )
}

export default LeererZustand
