import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import OutlinedInput from '@mui/material/OutlinedInput'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { fehlertext } from '../api/fehler'
import lazbw from '../assets/lazbw.png'
import ThemeToggle from '../components/ThemeToggle'
import { useAnmeldung } from './useSitzung'
import { sichererWeiterPfad, WEITER_PARAM } from './weiter'
// The brand block and the link colour are the shell's, and this page borrows
// both rather than restating them. Imported explicitly rather than relying on
// the shell having been loaded by some other route first.
import '../components/shell.css'
import './anmeldung.css'

/* The front door.
 *
 * Everything else in the app is behind the guard, so this is the one screen
 * somebody can reach without a session, and the only place a password is ever
 * typed.
 *
 * It stands outside the app shell, by decision on 2026-09-08: a header carrying
 * an account area on the one page where nobody has an account reads as a mistake,
 * and there is no navigation to skip past, so the skip link has nothing to do
 * here either. Two things the shell was providing are kept on the card instead.
 * The theme toggle, because somebody who needs the light theme needs it before
 * signing in, not after. And the two legal links, because a public authority's
 * Impressum and Datenschutzerklärung have to be reachable from every page.
 *
 * The two fields are built from FormControl, FormLabel and OutlinedInput rather
 * than from TextField, for the same reason FeldText gives: the label sits above
 * the field on this project, and TextField's own label floats into the border
 * notch. Same MUI input, without a wrapper that fights the design.
 */

/* Reachable from everywhere by law, which is why these two are here and the
   footer's other three (Barrierefreiheit, Hilfe, Kontakt) are not: those are
   useful, and this page is not the place to be useful at the expense of being
   plain. */
const RECHTLICHES = ['impressum', 'datenschutz'] as const

/* Only presence is checked here. Whether the address exists and whether the
   password is right are the server's to answer, and deliberately the same
   answer, so that this page cannot be used to find out who has an account.
   Checking the address looks like an address would add nothing and would refuse
   before asking, which is one more difference somebody probing could measure. */
const anmeldungSchema = z.object({
  email: z.string().trim().min(1, { message: 'anmeldung.fehlt.email' satisfies ParseKeys }),
  passwort: z.string().min(1, { message: 'anmeldung.fehlt.passwort' satisfies ParseKeys }),
})

type Anmeldedaten = z.infer<typeof anmeldungSchema>

function AnmeldungSeite() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [suchparameter] = useSearchParams()
  const anmeldung = useAnmeldung()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Anmeldedaten>({
    resolver: zodResolver(anmeldungSchema),
    defaultValues: { email: '', passwort: '' },
  })

  const ziel = sichererWeiterPfad(suchparameter.get(WEITER_PARAM))

  const absenden = handleSubmit((werte) => {
    anmeldung.mutate(werte, {
      /* replace, so the browser's back button returns to wherever they came
         from rather than to a login page they are already past. */
      onSuccess: () => void navigate(ziel, { replace: true }),
    })
  })

  const abgelehnt = anmeldung.error ? fehlertext(anmeldung.error) : undefined

  return (
    <div className="anmeldung-seite">
      {/* In the page's corner rather than on the card, so the card holds nothing
          but who this is and how to sign in. Still on the page at all, because
          somebody who needs the light theme needs it before signing in. */}
      <div className="anmeldung__thema">
        <ThemeToggle />
      </div>

      <main className="anmeldung">
        {/* Stacked and centred here, a row in the header, but the same three
            elements either way, so the real logo replaces brand__mark in one
            place when FFS supplies it. The organisation name and the form name
            are proper nouns and stay untranslated, as in SiteHeader. */}
        <div className="brand anmeldung__marke">
          {/* Decorative: the name is directly beneath it. See SiteHeader. */}
          <img className="brand__mark" src={lazbw} alt="" />
          <span className="brand__text">
            <span className="brand__org">Fischereiforschungsstelle Baden-Württemberg</span>
            <span className="brand__app">Protokoll E-Befischung</span>
          </span>
        </div>

        <Typography variant="h1" gutterBottom>
          {t('anmeldung.titel')}
        </Typography>
        <Typography variant="body1" className="anmeldung__einleitung">
          {t('anmeldung.einleitung')}
        </Typography>

        {/* role="alert" so a refusal is announced rather than only drawn. It sits
            above the fields and before them in the DOM, which is where somebody
            re-reading the form after a failure will look. */}
        {abgelehnt && (
          <Alert severity="error" role="alert" className="anmeldung__fehler">
            {abgelehnt.art === 'schluessel' ? t(abgelehnt.schluessel) : abgelehnt.text}
          </Alert>
        )}

        <form className="anmeldung__form" onSubmit={(ereignis) => void absenden(ereignis)} noValidate>
          <FormControl error={Boolean(errors.email)} fullWidth>
            <FormLabel htmlFor="email">{t('anmeldung.email')}</FormLabel>
            <OutlinedInput
              {...register('email')}
              id="email"
              type="email"
              /* username rather than email: it is what password managers look for
                 on a sign-in form, and it is the account identifier here. */
              autoComplete="username"
              autoFocus
              inputProps={{
                'aria-required': true,
                'aria-invalid': errors.email ? true : undefined,
                'aria-describedby': errors.email ? 'email-fehler' : undefined,
              }}
            />
            {errors.email && (
              <FormHelperText id="email-fehler">
                {t(errors.email.message as ParseKeys)}
              </FormHelperText>
            )}
          </FormControl>

          <FormControl error={Boolean(errors.passwort)} fullWidth>
            <FormLabel htmlFor="passwort">{t('anmeldung.passwort')}</FormLabel>
            <OutlinedInput
              {...register('passwort')}
              id="passwort"
              type="password"
              autoComplete="current-password"
              inputProps={{
                'aria-required': true,
                'aria-invalid': errors.passwort ? true : undefined,
                'aria-describedby': errors.passwort ? 'passwort-fehler' : undefined,
              }}
            />
            {errors.passwort && (
              <FormHelperText id="passwort-fehler">
                {t(errors.passwort.message as ParseKeys)}
              </FormHelperText>
            )}
          </FormControl>

          <Button type="submit" variant="contained" disabled={anmeldung.isPending} fullWidth>
            {t(anmeldung.isPending ? 'anmeldung.laeuft' : 'anmeldung.absenden')}
          </Button>
        </form>
      </main>

      <nav className="anmeldung__recht" aria-label={t('shell.footer.legalNavLabel')}>
        {RECHTLICHES.map((key) => (
          <a key={key} className="shell-link" href={`/${key}`}>
            {t(`shell.footer.${key}`)}
          </a>
        ))}
      </nav>
    </div>
  )
}

export default AnmeldungSeite
