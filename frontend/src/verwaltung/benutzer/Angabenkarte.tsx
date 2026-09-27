import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFehlertext } from '../../api/useFehlertext'
import type { BenutzerAntwort } from '../../api/typen'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'
import { SUPPORTED_LOCALES } from '../../i18n/sprachen'
import { labelId } from '../../protokoll/felder/rahmen'
import {
  formularAusKonto,
  kontoAenderung,
  kontoAendernSchema,
  entziehtSichSuperAdmin,
  type Kontoaenderungsformular,
} from './aendern'
import { fehltDieRegion, istRegional } from './eingabe'
import { feldFuerFehler, type Fehlerfeld } from './fehlerfelder'
import Kontofeld from './Kontofeld'
import Regionsfeld from './Regionsfeld'
import Rollenauswahl from './Rollenauswahl'
import { useFeldmeldung } from './useFeldmeldung'
import { useKontoAendern } from './useKontoAendern'

interface AngabenkarteProps {
  konto: BenutzerAntwort
  /** Null while the session is still being checked, never a guess. */
  eigeneId: string | null
}

/* The account's four editable answers.
 *
 * The same four controls the create form has, from the same components, minus the
 * password: that goes through its own endpoint on its own card, for the reason
 * feature 16a separated them.
 *
 * **Only what changed is sent.** kontoAenderung works that out, and the reason it
 * matters is that an account has no version column: sending the whole form every
 * time would mean two administrators editing different fields overwrote each
 * other. It also means unticking the regional role clears its number in the same
 * request, which the backend requires rather than doing for us.
 */
function Angabenkarte({ konto, eigeneId }: AngabenkarteProps) {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitted },
    reset,
    setValue,
  } = useForm<Kontoaenderungsformular>({
    resolver: zodResolver(kontoAendernSchema),
    defaultValues: formularAusKonto(konto),
    /* Nothing is said until the button is pressed, and from then on every message
       follows what is typed. The create form records why onTouched is wrong here:
       it reports a field the moment it is left, so clicking a role checkbox
       inserts a message above the group and moves the checkbox out from under the
       pointer as it is being clicked. */
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const aendern = useKontoAendern(konto.id, konto.id === eigeneId)
  const serverText = useFehlertext(aendern.error)
  const serverFeld = feldFuerFehler(aendern.error)

  /* True once a save went through and nothing has been typed since. Not taken from
     the mutation's own success flag, which would keep saying so while somebody
     typed the next change. */
  const [gespeichert, setGespeichert] = useState(false)

  /* Said when the button was pressed with nothing to send. Not an error: nothing
     went wrong, there was simply no request to make. */
  const [unveraendert, setUnveraendert] = useState(false)

  const verwerfeMeldungen = () => {
    if (aendern.error !== null) aendern.reset()
    if (gespeichert) setGespeichert(false)
    if (unveraendert) setUnveraendert(false)
  }

  /** The server's sentence, but only under the control it is actually about. */
  const serverMeldung = (feld: Fehlerfeld) => (serverFeld === feld ? serverText : undefined)

  const meldung = useFeldmeldung()

  /* Read live from the two fields they depend on, so which field is drawn and
     whether the form can be sent are one fact rather than two that can disagree.
     useWatch on those two rather than watch() over everything, which would
     re-render the form on every keystroke in every field. */
  const rollen = useWatch({ control, name: 'rollen' })
  const gewaehlteRegion = useWatch({ control, name: 'regierungspraesidium' })
  const regional = istRegional(rollen)

  /* Said as soon as the box is unticked rather than after the server refuses. A
     refusal somebody could have been told about beforehand is a wasted round trip
     and a worse explanation. */
  const entmachtetSichSelbst = entziehtSichSuperAdmin(konto, eigeneId, rollen)

  /* Said only once the button has been pressed. Revealing the region field and
     marking it wrong in the same instant would be telling somebody off for not
     having answered a question they have just been asked. */
  const zeigeFehlendeRegion = isSubmitted && fehltDieRegion(rollen, gewaehlteRegion)

  const regionMeldung = zeigeFehlendeRegion
    ? t('benutzerverwaltung.felder.fehlt.regierungspraesidium')
    : serverMeldung('regierungspraesidium')

  /* The browser's own rule first, because it needs no round trip, then Zod's, then
     whatever the server said about the roles. */
  const rollenMeldung =
    (entmachtetSichSelbst ? t('benutzerverwaltung.aendern.selbstentzug.rollen') : undefined) ??
    meldung(errors.rollen?.message) ??
    serverMeldung('rollen')

  return (
    <section className="card konto-aendern__karte">
      <div className="konto-aendern__kopf">
        <Typography variant="h2">{t('benutzerverwaltung.aendern.angaben.titel')}</Typography>
        <Typography variant="body2" className="konto-aendern__einleitung">
          {t('benutzerverwaltung.aendern.angaben.einleitung')}
        </Typography>
      </div>

      {/* noValidate, so the browser's own bubbles stay out of the way of the
          German messages this form places under each field. One opinion per
          field.

          konto-anlegen__inhalt is the create form's own grid and inset, reused
          rather than restated: these are the same four fields in the same places,
          and a second stylesheet saying so is a second one to keep in step. */}
      <form
        className="konto-anlegen__inhalt"
        noValidate
        /* Covers the text field and the six checkboxes in one place, because a
           real input's change event bubbles to the form. **The two dropdowns are
           not covered by this** and clear the messages themselves: MUI's Select
           is a div with a hidden input and emits no change that arrives here,
           which a browser check on the create screen caught as a stale message
           surviving a change of region. */
        onChange={verwerfeMeldungen}
        onSubmit={(ereignis) => {
          ereignis.preventDefault()
          void handleSubmit((formular) => {
            const ergebnis = kontoAenderung(konto, formular)

            /* The region is ticked but unchosen. Nothing is sent and
               zeigeFehlendeRegion says why, under the control. */
            if (ergebnis.art === 'unvollstaendig') return

            if (ergebnis.art === 'unveraendert') {
              setUnveraendert(true)
              return
            }

            /* Refused before the request, because the server would refuse it
               anyway and this way the reason sits under the roles rather than
               beside the button. */
            if (entziehtSichSuperAdmin(konto, eigeneId, formular.rollen)) return

            aendern.mutate(ergebnis.anfrage, {
              /* The saved answer becomes the new baseline, so "nothing changed" is
               * true again and a second press of the button sends nothing.
               *
               * **Driven by this card's own answer, and by nothing else.** This
               * used to hang off the account the query holds, which looked
               * equivalent and was not: locking the account in the card below
               * writes a fresh account into the same cache entry, and this form
               * would have refilled from it, throwing away an address somebody had
               * typed but not yet saved.
               *
               * What it deliberately does not do is follow an edit made elsewhere.
               * Another administrator changing this account while it is open leaves
               * the form showing what it was opened with, and the next save sends
               * those values. Accepted knowingly: an account carries no version and
               * the API has no refusal for a stale edit, so the alternative is
               * wiping an edit in progress every time anything refetches. */
              onSuccess: (gespeichertesKonto) => {
                reset(formularAusKonto(gespeichertesKonto))
                setGespeichert(true)
                setUnveraendert(false)
              },
            })
          })(ereignis)
        }}
      >
        <Kontofeld<Kontoaenderungsformular>
          name="email"
          labelKey="benutzerverwaltung.felder.email"
          hinweisKey="benutzerverwaltung.felder.emailHinweis"
          autoComplete="off"
          register={register}
          meldung={meldung(errors.email?.message) ?? serverMeldung('email')}
        />

        <Controller
          name="rollen"
          control={control}
          render={({ field }) => (
            <Rollenauswahl
              gewaehlt={field.value}
              onAendern={(neue) => {
                field.onChange(neue)
                verwerfeMeldungen()
                /* A region left behind by a role that is no longer ticked would
                   reappear, already chosen, if somebody ticked the role again,
                   and would look like an answer they had given. kontoAenderung
                   sends null for it either way; this keeps it off the screen. */
                if (!istRegional(neue)) setValue('regierungspraesidium', '')
              }}
              meldung={rollenMeldung}
            />
          )}
        />

        {/* Only while the role that needs it is ticked. An account with no
            regional role may not carry a number at all, so a field offering one
            would be offering a way to be refused. */}
        {regional && (
          <Controller
            name="regierungspraesidium"
            control={control}
            render={({ field }) => (
              <Regionsfeld
                wert={field.value}
                onAendern={(gewaehlt) => {
                  field.onChange(gewaehlt)
                  verwerfeMeldungen()
                }}
                meldung={regionMeldung}
              />
            )}
          />
        )}

        <FormControl className="konto-anlegen__feld">
          <FormLabel id={labelId('locale')} htmlFor="locale">
            {t('benutzerverwaltung.felder.sprache')}
          </FormLabel>
          <Controller
            name="locale"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                onChange={(ereignis) => {
                  field.onChange(ereignis)
                  verwerfeMeldungen()
                }}
                /* The control somebody reaches is a div with role="combobox",
                   not an input, so <label for> cannot name it. These two props
                   are the wiring that does. */
                labelId={labelId('locale')}
                SelectDisplayProps={{ id: 'locale' }}
              >
                {SUPPORTED_LOCALES.map((sprache) => (
                  <MenuItem key={sprache} value={sprache}>
                    {t(`benutzerverwaltung.felder.sprachen.${sprache}` satisfies ParseKeys)}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </FormControl>

        {/* Only what no field would carry: the network being down, one of the two
            safety rules, or a code this build has never heard of. Anything about
            one answer is already under that answer. */}
        {serverText !== undefined && serverFeld === undefined && (
          <Alert severity="error" className="konto-anlegen__meldung">
            {serverText}
          </Alert>
        )}

        {/* A live region either way, so somebody who cannot see the form is told
            what pressing the button did. */}
        {gespeichert && serverText === undefined && (
          <Alert severity="success" role="status" className="konto-anlegen__meldung">
            {t('benutzerverwaltung.aendern.angaben.gespeichert')}
          </Alert>
        )}

        {unveraendert && (
          <Alert severity="info" role="status" className="konto-anlegen__meldung">
            {t('benutzerverwaltung.aendern.angaben.unveraendert')}
          </Alert>
        )}

        <div className="konto-anlegen__aktionen">
          <Button type="submit" variant="contained" disabled={aendern.isPending}>
            {t(
              aendern.isPending
                ? 'benutzerverwaltung.aendern.angaben.laeuft'
                : 'benutzerverwaltung.aendern.angaben.speichern',
            )}
          </Button>
          <Button component={Link} to={BENUTZERVERWALTUNG} variant="outlined">
            {t('benutzerverwaltung.aendern.zurListe')}
          </Button>
        </div>
      </form>
    </section>
  )
}

export default Angabenkarte
