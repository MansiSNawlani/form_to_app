import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useKontoSprache } from './useKontoSprache'
import { useSitzung } from './useSitzung'
import { anmeldungsZiel } from './weiter'

/* The lock on every screen except the login page.
 *
 * A layout route with no markup of its own: it renders whatever page was asked
 * for, or a redirect instead of it. Wrapping the routes rather than checking
 * inside each page is the point. A page that checks for itself is a page that
 * can be added without the check, and nobody notices until the wrong person is
 * looking at somebody else's protocol.
 *
 * This is a rule about where the browser goes, not a security boundary. Anybody
 * with developer tools can switch it off, and today that only shows them their
 * own drafts, which live in their own browser. The real boundary is the backend,
 * which checks the session on every request through the aktueller_benutzer
 * dependency, and it becomes load-bearing at feature 3 when drafts move to the
 * server.
 */
function SitzungsWaechter() {
  const sitzung = useSitzung()
  const ort = useLocation()
  const { t } = useTranslation()

  /* Here rather than in the header, because this is the one component that
     exists for every signed-in screen and for no other reason. Hooks run before
     the returns below, so it is called on every render whatever the state. */
  useKontoSprache(sitzung.zustand === 'angemeldet' ? sitzung.benutzer.locale : undefined)

  /* Neither signed in nor signed out yet.
   *
   * The important case, and the reason the session has three states rather than
   * a boolean. Treating "do not know" as "signed out" would send a signed-in
   * person past the login page on every reload, and they would see it flash. */
  if (sitzung.zustand === 'wird_geprueft') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <CircularProgress role="status" aria-label={t('sitzung.wirdGeprueft')} />
      </Box>
    )
  }

  if (sitzung.zustand === 'abgemeldet') {
    /* The whole address, so a link into one section of one protocol comes back
       to that section and not to the home page. replace, so the page they could
       not see does not sit in the history for the back button to return to. */
    const gefragt = `${ort.pathname}${ort.search}${ort.hash}`
    return <Navigate to={anmeldungsZiel(gefragt)} replace />
  }

  return <Outlet />
}

export default SitzungsWaechter
