import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'

/* The address names no account.
 *
 * Nothing went wrong and nothing is lost, so this is not shaped like an error and
 * carries no retry button: an id that names no account will name none however many
 * times it is asked for, which is also why the query behind this page declines to
 * retry it.
 *
 * Usually a stale link. An account is never deleted in this application, by
 * decision in feature 2a, so the row behind a link that once worked is still
 * there; what is more likely is a link typed by hand or one from a chat message
 * that lost a character. Either way the one useful thing to offer is the list,
 * where every account there is can be found by address.
 */
function KeinKonto() {
  const { t } = useTranslation()

  return (
    <section className="card">
      <div className="empty">
        <Typography variant="h2">{t('benutzerverwaltung.aendern.keinKonto.titel')}</Typography>
        <Typography variant="body1">{t('benutzerverwaltung.aendern.keinKonto.text')}</Typography>
        <Button
          component={Link}
          to={BENUTZERVERWALTUNG}
          variant="contained"
          className="empty__aktion"
        >
          {t('benutzerverwaltung.aendern.keinKonto.knopf')}
        </Button>
      </div>
    </section>
  )
}

export default KeinKonto
