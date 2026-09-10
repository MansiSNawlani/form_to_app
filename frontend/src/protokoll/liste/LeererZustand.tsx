import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/* What the page shows an account that has never started a protocol.
 *
 * It says how the thing works rather than only that there is nothing here. A
 * surveyor meeting this screen has not yet learned that a protocol is filled in
 * over several sittings and that nothing is sent until they say so, and this is
 * the one moment they are looking at a page with room to say it.
 *
 * Shown only for a list that loaded and is empty. A failed request is a
 * different thing and says so, because "you have no protocols" would be a lie
 * told to somebody whose work is sitting safely on a server we could not reach.
 */
function LeererZustand() {
  const { t } = useTranslation()

  return (
    <section className="card">
      <div className="empty">
        <Typography variant="h2">{t('protokolle.list.leer.titel')}</Typography>
        <Typography variant="body1">
          {t('protokolle.list.leer.text')}
        </Typography>
        <Button
          component={Link}
          to="/protokolle/neu"
          variant="contained"
          className="empty__aktion"
        >
          {t('protokolle.list.leer.knopf')}
        </Button>
      </div>
    </section>
  )
}

export default LeererZustand
