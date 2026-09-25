import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

interface LeererZustandProps {
  /** True when something has been typed, so the emptiness is this search's and
      not the application's. */
  gesucht: boolean
  onZuruecksetzen: () => void
}

/* Nothing to show, and which of the two reasons it is.
 *
 * The distinction is the whole point of this component, the same one
 * pruefliste/LeererZustand.tsx makes: "there are no accounts" and "nothing matches
 * what you typed" look identical on screen and need opposite responses. Telling
 * somebody the application has no accounts when they have quietly typed a
 * misspelled domain sends them looking for a fault that is not there.
 *
 * **The unsearched case cannot actually happen**, and is written anyway. Somebody
 * is reading this page, so there is at least one account: their own. What it
 * replaces is a table with a head and no body, which reads as a fault rather than
 * as a fact, and it names the command that makes an account rather than inventing
 * a reason there are none.
 *
 * Only the searched case offers a way out, because there is nothing to reset in
 * the other one and a button that does nothing is worse than no button.
 */
function LeererZustand({ gesucht, onZuruecksetzen }: LeererZustandProps) {
  const { t } = useTranslation()
  const bereich = gesucht ? 'keineTreffer' : 'leer'

  return (
    <div className="empty">
      <Typography variant="h2">{t(`benutzerverwaltung.${bereich}.titel`)}</Typography>
      <Typography variant="body1">{t(`benutzerverwaltung.${bereich}.text`)}</Typography>
      {gesucht && (
        <Button variant="outlined" className="empty__aktion" onClick={onZuruecksetzen}>
          {t('benutzerverwaltung.suche.zuruecksetzen')}
        </Button>
      )}
    </div>
  )
}

export default LeererZustand
