import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import { useFehlertext } from '../../api/useFehlertext'
import type { BenutzerAntwort } from '../../api/typen'
import { darfSperren } from './aendern'
import { useKontoAendern } from './useKontoAendern'

interface ZugangskarteProps {
  konto: BenutzerAntwort
  /** Null while the session is still being checked, never a guess. */
  eigeneId: string | null
}

/* Whether the account can be signed in to.
 *
 * **Its own card rather than a checkbox in the form above.** Locking somebody out
 * is something an administrator does at a moment, because a person has left or an
 * account may have been compromised, not something they adjust while correcting a
 * typo in an address. A checkbox between the roles and the language is something
 * you can change by accident and not notice you have saved.
 *
 * **It sends ist_aktiv and nothing else**, built from the account rather than from
 * the form above. Somebody who types a new address, thinks better of it and then
 * presses this button must not have the address saved along with the lock.
 *
 * **Locking is the one change here that takes effect at once.** aktueller_benutzer
 * loads the account row on every single request, so a locked account is refused on
 * its very next one. That is why the password card points at this one: a new
 * password does not end a session that is already running.
 *
 * Nothing here deletes. An account is never deleted in this application, because a
 * deleted account takes the owner of every protocol it filed with it, and
 * app/benutzer/dienst.py has said so since feature 2a. Locking is the answer, which
 * is also why this card is not styled as a hazard: it is reversible by the person
 * reading it, with the button directly below.
 */
function Zugangskarte({ konto, eigeneId }: ZugangskarteProps) {
  const { t } = useTranslation()

  const aendern = useKontoAendern(konto.id, konto.id === eigeneId)
  const fehlertext = useFehlertext(aendern.error)

  /* Open exactly while a lock is waiting to be confirmed. Unlocking asks nothing:
     it gives an account its access back, which is neither destructive nor hard to
     undo, and a dialog in front of it would be ceremony. */
  const [fragtNach, setFragtNach] = useState(false)

  const erlaubt = darfSperren(konto, eigeneId)

  const umschalten = (aktiv: boolean) => {
    aendern.mutate({ ist_aktiv: aktiv }, { onSuccess: () => setFragtNach(false) })
  }

  return (
    <section className="card konto-aendern__karte">
      <div className="konto-aendern__kopf">
        <Typography variant="h2">{t('benutzerverwaltung.aendern.zugang.titel')}</Typography>
        <p className="konto-aendern__einleitung">
          {t('benutzerverwaltung.aendern.zugang.einleitung')}
        </p>
      </div>

      <div className="konto-aendern__abschnitt">
        {/* The state in words above the button that changes it, so what is true now
            is never read off the button's label alone. A button saying "sperren"
            tells you what it does, not what the account currently is. */}
        <Typography variant="body1" className="konto-aendern__status">
          <Trans
            i18nKey={
              konto.ist_aktiv
                ? 'benutzerverwaltung.aendern.zugang.istAktiv'
                : 'benutzerverwaltung.aendern.zugang.istGesperrt'
            }
          />
        </Typography>

        {erlaubt ? (
          konto.ist_aktiv ? (
            <Button
              variant="outlined"
              color="error"
              disabled={aendern.isPending}
              onClick={() => setFragtNach(true)}
            >
              {t('benutzerverwaltung.aendern.zugang.sperren')}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={aendern.isPending}
              onClick={() => umschalten(true)}
            >
              {t(
                aendern.isPending
                  ? 'benutzerverwaltung.aendern.zugang.laeuft'
                  : 'benutzerverwaltung.aendern.zugang.entsperren',
              )}
            </Button>
          )
        ) : (
          /* No button at all on your own account, rather than one that can only
             fail. Feature 16a refuses this outright: locking yourself signs you out
             of the screen you are standing on, with no way back except asking
             somebody else. Offering the action and then explaining why it was
             refused would be inviting a mistake in order to describe it. */
          <p className="konto-aendern__selbst">
            {t('benutzerverwaltung.aendern.zugang.eigenes')}
          </p>
        )}

        {fehlertext !== undefined && <Alert severity="error">{fehlertext}</Alert>}
      </div>

      <BestaetigungsDialog
        offen={fragtNach}
        titel={t('benutzerverwaltung.aendern.zugang.frage.titel')}
        /* The account is named in the question. Somebody who has three of these
           screens open has only the address to tell them apart, and it is the one
           thing that says they are about to lock the wrong person out. */
        text={t('benutzerverwaltung.aendern.zugang.frage.text', { email: konto.email })}
        abbrechenLabel={t('benutzerverwaltung.aendern.zugang.frage.abbrechen')}
        bestaetigenLabel={t('benutzerverwaltung.aendern.zugang.frage.bestaetigen')}
        laeuft={aendern.isPending}
        onAbbrechen={() => setFragtNach(false)}
        onBestaetigen={() => umschalten(false)}
      />
    </section>
  )
}

export default Zugangskarte
