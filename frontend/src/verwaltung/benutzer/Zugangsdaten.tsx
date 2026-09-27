import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'

/* What the administrator has to pass on, shown once.
 *
 * **This is the only moment the password exists anywhere it can be read.** The API
 * does not return it, does not log it and does not echo it in a validation error;
 * the browser has it only because it is what was just typed. Sending the
 * administrator straight back to the list would throw away the one thing they now
 * have to give somebody.
 *
 * It is held in the page's own state and nowhere else: not in the query cache, not
 * in localStorage, not in the address. Leaving the page loses it, which is
 * correct. From then on the copy that matters belongs to its owner.
 *
 * **The fourth sentence has to be exactly true rather than reassuring.** Nobody can
 * change their own password in this application: feature 16a left self-service out
 * deliberately, because it needs the current password first and is a different rule
 * set. So this does not say "change it at first sign-in", which would send somebody
 * looking for a screen that does not exist. It says an administrator sets a new one,
 * which is what 16d builds and what is true today at the command line.
 */

interface ZugangsdatenProps {
  email: string
  passwort: string
  /** Clears the form and starts again, without leaving the page. */
  onWeiteres: () => void
}

function Zugangsdaten({ email, passwort, onWeiteres }: ZugangsdatenProps) {
  const { t } = useTranslation()

  return (
    <div className="konto-anlegen__fertig">
      {/* A live region, so somebody who cannot see the panel appear is told the
          account was made rather than left on a form that quietly emptied. */}
      <Alert severity="success" role="status">
        {t('benutzerverwaltung.anlegen.fertig.titel', { email })}
      </Alert>

      <Typography variant="body1">{t('benutzerverwaltung.anlegen.fertig.weitergeben')}</Typography>

      {/* A description list, because these are two labelled values rather than a
          sentence: a screen reader announces the label with the value, and the
          pair can be selected and copied as it stands. */}
      <dl className="konto-anlegen__zugangsdaten">
        <dt>{t('benutzerverwaltung.anlegen.email')}</dt>
        <dd>{email}</dd>
        <dt>{t('benutzerverwaltung.anlegen.passwort')}</dt>
        {/* The password is shown, not masked. Masking it here would defeat the
            only purpose this panel has, which is that it gets read out. */}
        <dd className="konto-anlegen__passwort">{passwort}</dd>
      </dl>

      <Typography variant="body1">{t('benutzerverwaltung.anlegen.fertig.nurEinmal')}</Typography>
      <Typography variant="body1">{t('benutzerverwaltung.anlegen.fertig.keinWechsel')}</Typography>

      <div className="konto-anlegen__aktionen">
        <Button variant="contained" onClick={onWeiteres}>
          {t('benutzerverwaltung.anlegen.fertig.weiteres')}
        </Button>
        <Button component={Link} to={BENUTZERVERWALTUNG} variant="outlined">
          {t('benutzerverwaltung.anlegen.fertig.zurListe')}
        </Button>
      </div>
    </div>
  )
}

export default Zugangsdaten
