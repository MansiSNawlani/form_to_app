import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/* Signed in, but this page is not for this account.
 *
 * Not an error, and deliberately not shaped like one. Nothing went wrong, nothing
 * is lost, and trying again would only produce the same refusal more slowly,
 * which is why there is no retry button here and why abfragen.ts does not retry
 * the request behind it either.
 *
 * It names the page, says in plain words who it is for, says what to do about it,
 * and gives a link to somewhere this account can actually go. A refusal with no
 * way out reads as the application being broken rather than as a boundary working
 * correctly.
 *
 * The server is what refuses; this only reports the refusal. The route carries no
 * role check of its own, because a second opinion in the browser could only ever
 * be the wrong one.
 */
function KeineBerechtigung() {
  const { t } = useTranslation()

  return (
    <section className="card">
      <div className="empty">
        <Typography variant="h2">{t('pruefliste.keineBerechtigung.titel')}</Typography>
        <Typography variant="body1">{t('pruefliste.keineBerechtigung.text')}</Typography>
        <Button component={Link} to="/" variant="contained" className="empty__aktion">
          {t('pruefliste.keineBerechtigung.knopf')}
        </Button>
      </div>
    </section>
  )
}

export default KeineBerechtigung
