import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useTranslation } from 'react-i18next'
import { useSitzung, useSpracheSpeichern } from '../auth/useSitzung'
import { setLocale } from '../i18n'
import { SPRACHEN, SUPPORTED_LOCALES, localeFuer, type Locale } from '../i18n/sprachen'

/* DE and EN, beside the theme toggle, for everybody.
 *
 * Two short buttons rather than a labelled dropdown so the header stays on one
 * line. Each is named by its language in that language, and carries lang, so a
 * screen reader reading the German interface still says "English" in English:
 * the person looking for it may not understand the language they are stuck in.
 *
 * Signed out, the choice lives on this device only. Signed in, the screen
 * switches at once and the account is saved behind it, so the next sign-in
 * anywhere starts in the same language. A failed save leaves the screen as
 * chosen until the next reload, when the account wins again, and says so;
 * clicking the chosen button again retries, which is why a click on the
 * selected button is not ignored the way ToggleButtonGroup normally ignores it.
 */
function SprachUmschalter() {
  const { t, i18n } = useTranslation()
  const sitzung = useSitzung()
  const { speichern, laeuft, fehlgeschlagen, verwerfen } = useSpracheSpeichern()
  const aktuelleLocale = localeFuer(i18n.language)

  /* Skipped only when the account already says this and nothing else is under
     way. While a save is running, or after one failed, the account in the cache
     may be about to change or may be wrong, so a click that agrees with it
     still sends its own save: EN then DE quickly must end on DE. */
  function waehlen(locale: Locale) {
    if (locale !== i18n.language) setLocale(locale)
    if (sitzung.zustand !== 'angemeldet') return
    if (sitzung.benutzer.locale === locale && !laeuft && !fehlgeschlagen) return
    speichern(locale)
  }

  return (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={aktuelleLocale}
        onChange={(_, neu: Locale | null) => waehlen(neu ?? aktuelleLocale)}
        aria-label={t('shell.header.sprache')}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <ToggleButton
            key={locale}
            value={locale}
            lang={locale}
            aria-label={SPRACHEN[locale].name}
            title={SPRACHEN[locale].name}
          >
            {locale.toUpperCase()}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Snackbar
        open={fehlgeschlagen}
        onClose={verwerfen}
        autoHideDuration={10000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" role="alert" onClose={verwerfen}>
          {t('shell.header.spracheNichtGespeichert', {
            sprache: SPRACHEN[aktuelleLocale].name,
            kuerzel: aktuelleLocale.toUpperCase(),
          })}
        </Alert>
      </Snackbar>
    </>
  )
}

export default SprachUmschalter
