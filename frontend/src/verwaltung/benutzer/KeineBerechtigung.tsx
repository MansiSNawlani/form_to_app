import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { MEINE_PROTOKOLLE } from '../../auth/startseite'

/* Signed in, but this page is not for this account.
 *
 * Not an error, and deliberately not shaped like one. Nothing went wrong, nothing
 * is lost, and trying again would only produce the same refusal more slowly, which
 * is why there is no retry button here and why abfragen.ts does not retry the
 * request behind it either.
 *
 * It names the page, says in plain words who it is for, says what to do about it,
 * and gives a link to somewhere this account can actually go. A refusal with no way
 * out reads as the application being broken rather than as a boundary working
 * correctly.
 *
 * The wording is this screen's own rather than the Pruefliste's, for the reason
 * that screen's version already gives: what somebody wants on being turned away
 * from the account list is to know who does manage accounts, which is not what a
 * surveyor turned away from the review queue needs to hear.
 *
 * The server is what refuses; this only reports the refusal. The route carries no
 * role check of its own, because a second opinion in the browser could only ever be
 * the wrong one.
 */
function KeineBerechtigung() {
  const { t } = useTranslation()

  return (
    <section className="card">
      <div className="empty">
        <Typography variant="h2">{t('benutzerverwaltung.keineBerechtigung.titel')}</Typography>
        <Typography variant="body1">{t('benutzerverwaltung.keineBerechtigung.text')}</Typography>
        <Button component={Link} to={MEINE_PROTOKOLLE} variant="contained" className="empty__aktion">
          {t('benutzerverwaltung.keineBerechtigung.knopf')}
        </Button>
      </div>
    </section>
  )
}

export default KeineBerechtigung
