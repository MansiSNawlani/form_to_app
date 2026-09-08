import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { fehlertext } from '../api/fehler'
import { useAbmeldung } from './useSitzung'
import { ANMELDUNG_PFAD } from './weiter'

/* Signing out.
 *
 * The person is moved to the login page rather than left on a screen they may
 * no longer read, waiting for the next request to fail.
 *
 * Nothing is thrown away locally beyond the cache. Drafts live in this browser
 * and survive, because deleting a half-typed protocol over a mistaken click
 * would be far worse than the tidiness gained. That is also why a shared
 * computer still shows the next person the last person's drafts, which feature 3
 * fixes properly by moving drafts to the server.
 */
function AbmeldeKnopf() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const abmeldung = useAbmeldung()

  /* A failure here means the request never landed, so the cookie is still good
     and the person is still signed in. Saying so, and staying put, is the only
     honest answer: sending them to the login page would suggest they were
     signed out when they were not. */
  const fehler = abmeldung.error ? fehlertext(abmeldung.error) : undefined

  return (
    <>
      {fehler && (
        <span className="site-header__fehler" role="alert">
          {fehler.art === 'schluessel' ? t(fehler.schluessel) : fehler.text}
        </span>
      )}
      <Button
        size="small"
        variant="outlined"
        disabled={abmeldung.isPending}
        onClick={() =>
          abmeldung.mutate(undefined, {
            onSuccess: () => void navigate(ANMELDUNG_PFAD, { replace: true }),
          })
        }
      >
        {t(abmeldung.isPending ? 'sitzung.abmeldungLaeuft' : 'sitzung.abmelden')}
      </Button>
    </>
  )
}

export default AbmeldeKnopf
