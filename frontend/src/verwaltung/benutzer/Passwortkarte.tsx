import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useFehlertext } from '../../api/useFehlertext'
import type { BenutzerAntwort } from '../../api/typen'
import { feldFuerFehler } from './fehlerfelder'
import Kontofeld from './Kontofeld'
import { kontoSchema } from './eingabe'
import { useFeldmeldung } from './useFeldmeldung'
import { useKontoPasswort } from './useKontoAendern'

/* The create form's password rule, on its own.
 *
 * Picked out of kontoSchema rather than restated, so the twelve character minimum
 * and its message exist once. The number itself comes from MINDESTLAENGE in
 * backend/app/security/passwoerter.py, and the backend is still the gate: this
 * exists so the message appears under the field while somebody types rather than
 * after a round trip.
 */
const passwortSchema = z.object({ passwort: kontoSchema.shape.passwort })

type Passwortformular = z.infer<typeof passwortSchema>

const LEER: Passwortformular = { passwort: '' }

interface PasswortkarteProps {
  konto: BenutzerAntwort
  /** Null while the session is still being checked, never a guess. */
  eigeneId: string | null
}

/* A new password for somebody who has lost theirs.
 *
 * **Its own card and its own form**, which is why it reads no field of the card
 * above and the card above reads none of its. Feature 16a separated the endpoint
 * for the same reason: the password is the one value on this screen that must
 * never be returned, never logged and never echoed in a validation error, and
 * keeping it away from the four ordinary fields is what makes that easy to hold
 * true.
 *
 * **Nobody can change their own password in this application yet.** Self-service
 * needs the current password first, which is a different rule set and a different
 * feature; 16a left it out deliberately. So an administrator sets one here, and
 * the panel afterwards has to say exactly that rather than the reassuring thing.
 */
function Passwortkarte({ konto, eigeneId }: PasswortkarteProps) {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Passwortformular>({
    resolver: zodResolver(passwortSchema),
    defaultValues: LEER,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const setzen = useKontoPasswort(konto.id, konto.id === eigeneId)
  const serverText = useFehlertext(setzen.error)
  const serverFeld = feldFuerFehler(setzen.error)

  /* What the panel shows once a password has been set, held in this component and
     nowhere else. Never the query cache, never localStorage, never the address:
     leaving the page is meant to lose it, and from then on the copy that matters
     belongs to its owner. */
  const [gesetzt, setGesetzt] = useState<string | null>(null)

  const meldung = useFeldmeldung()

  return (
    <section className="card konto-aendern__karte">
      <div className="konto-aendern__kopf">
        <Typography variant="h2">{t('benutzerverwaltung.aendern.passwort.titel')}</Typography>
        <Typography variant="body2" className="konto-aendern__einleitung">
          {t('benutzerverwaltung.aendern.passwort.einleitung')}
        </Typography>
      </div>

      {gesetzt !== null ? (
        <div className="konto-aendern__abschnitt konto-anlegen__fertig">
          {/* A live region, so somebody who cannot see the panel appear is told the
              password was changed rather than left on a form that quietly
              emptied. */}
          <Alert severity="success" role="status">
            {t('benutzerverwaltung.aendern.passwort.fertig.titel', { email: konto.email })}
          </Alert>

          <Typography variant="body1">
            {t('benutzerverwaltung.aendern.passwort.fertig.weitergeben')}
          </Typography>

          {/* A description list, because these are two labelled values rather than
              a sentence: a screen reader announces the label with the value, and
              the pair can be selected and copied as it stands. */}
          <dl className="konto-anlegen__zugangsdaten">
            <dt>{t('benutzerverwaltung.felder.email')}</dt>
            <dd>{konto.email}</dd>
            <dt>{t('benutzerverwaltung.felder.passwort')}</dt>
            {/* Shown, not masked. Masking it here would defeat the only purpose
                this panel has, which is that it gets read out. */}
            <dd className="konto-anlegen__passwort">{gesetzt}</dd>
          </dl>

          {/* The one that has to be exactly true rather than reassuring. A session
              the account already has keeps working, because the session token is
              stateless and carries nothing this call changed. Where the reset is
              because somebody else may have had the old password, locking is the
              part that takes effect at once. */}
          <Alert severity="info">
            {t('benutzerverwaltung.aendern.passwort.fertig.sitzungen')}
          </Alert>

          <Typography variant="body1">
            {t('benutzerverwaltung.aendern.passwort.fertig.keinWechsel')}
          </Typography>

          <div className="konto-anlegen__aktionen">
            <Button
              variant="outlined"
              onClick={() => {
                /* Both, and in this order. A form still holding the last password
                   would offer it as the next one. */
                reset(LEER)
                setzen.reset()
                setGesetzt(null)
              }}
            >
              {t('benutzerverwaltung.aendern.passwort.fertig.fertig')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="konto-aendern__abschnitt"
          noValidate
          onChange={() => {
            if (setzen.error !== null) setzen.reset()
          }}
          onSubmit={(ereignis) => {
            ereignis.preventDefault()
            void handleSubmit((formular) => {
              setzen.mutate(formular.passwort, {
                /* Taken from what was typed, because the answer deliberately
                   carries no password. */
                onSuccess: () => setGesetzt(formular.passwort),
              })
            })(ereignis)
          }}
        >
          <Kontofeld<Passwortformular>
            name="passwort"
            labelKey="benutzerverwaltung.aendern.passwort.neu"
            hinweisKey="benutzerverwaltung.aendern.passwort.neuHinweis"
            /* new-password, so a password manager offers to store this one rather
               than filling in the administrator's own. */
            autoComplete="new-password"
            register={register}
            meldung={
              meldung(errors.passwort?.message) ??
              (serverFeld === 'passwort' ? serverText : undefined)
            }
          />

          {/* Only what no field would carry: the network being down, or a code this
              build has never heard of. */}
          {serverText !== undefined && serverFeld !== 'passwort' && (
            <Alert severity="error">{serverText}</Alert>
          )}

          <Button type="submit" variant="contained" disabled={setzen.isPending}>
            {t(
              setzen.isPending
                ? 'benutzerverwaltung.aendern.passwort.laeuft'
                : 'benutzerverwaltung.aendern.passwort.setzen',
            )}
          </Button>
        </form>
      )}
    </section>
  )
}

export default Passwortkarte
