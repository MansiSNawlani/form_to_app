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
import { ApiFehler, ROLLE_FEHLT } from '../../api/fehler'
import { SUPPORTED_LOCALES } from '../../i18n/sprachen'
import { useFehlertext } from '../../api/useFehlertext'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'
import { labelId } from '../../protokoll/felder/rahmen'
import {
  fehltDieRegion,
  istRegional,
  kontoEingabe,
  kontoSchema,
  LEERES_FORMULAR,
  type Kontoformular,
} from './eingabe'
import { feldFuerFehler, type Fehlerfeld } from './fehlerfelder'
import KeineBerechtigung from './KeineBerechtigung'
import Kontofeld from './Kontofeld'
import Regionsfeld from './Regionsfeld'
import Rollenauswahl from './Rollenauswahl'
import { useFeldmeldung } from './useFeldmeldung'
import { useKontoAnlegen } from './useKontoAnlegen'
import Zugangsdaten from './Zugangsdaten'
/* The page furniture is the list pages': page__head and card. Imported
   explicitly rather than relying on another route having been loaded first,
   which is the reason AnmeldungSeite gives for importing the shell's stylesheet
   the same way. */
import '../../protokoll/liste/liste.css'
import './kontoanlegen.css'

/* Making an account, for the one role that may.
 *
 * The first screen in the application that writes an account. Until it existed
 * every account after the very first was made with `befischung benutzer anlegen`
 * in a terminal on the machine the database runs on, which is the dependency the
 * whole of feature 16 exists to remove.
 *
 * **No role check here**, the same rule routes.tsx already states for the account
 * list, the reviewer's page and the queue: the server decides who may do what, in
 * one place, and a second opinion in the browser could only ever be the wrong
 * one. An account with no business here is refused by the endpoint and told so in
 * words.
 *
 * **A page rather than a dialog on the list**, decided on 2026-09-25. The form is
 * five questions, one of which reveals a sixth, and what it ends on is something
 * an administrator reads, copies out of, and may sit on for a minute while they
 * ring the person whose account it is. None of that belongs in a dialog.
 *
 * Nothing here changes an account that exists. That is 16d.
 */

function KontoAnlegenSeite() {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitted },
    reset,
    setValue,
  } = useForm<Kontoformular>({
    resolver: zodResolver(kontoSchema),
    defaultValues: LEERES_FORMULAR,
    /* Nothing is said until the button is pressed, and from then on every message
       follows what is typed.
     *
     * Not onTouched, which was tried first and is wrong here for a reason worth
     * writing down: it reports a field the moment it is left, so clicking a role
     * checkbox blurs the address field, inserts a message above the group, and
     * moves the checkbox out from under the pointer as it is being clicked. The
     * browser tests caught it as a click that ticked nothing, and a person filling
     * the form in would have hit the same thing.
     *
     * Waiting for the button also matches how this form is used: five short
     * answers filled top to bottom, not a long form somebody works at over
     * sittings. reValidateMode keeps the second half of the rule, which is that a
     * message must visibly go away as its problem is fixed. */
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const meldung = useFeldmeldung()

  /* What the panel shows once an account has been made, held in this component and
     nowhere else. Never the query cache, never localStorage, never the address:
     leaving the page is meant to lose it. */
  const [angelegt, setAngelegt] = useState<{ email: string; passwort: string } | null>(null)

  const anlegen = useKontoAnlegen()
  const serverText = useFehlertext(anlegen.error)
  const serverFeld = feldFuerFehler(anlegen.error)

  /** The server's sentence, but only under the control it is actually about. */
  const serverMeldung = (feld: Fehlerfeld) =>
    serverFeld === feld ? serverText : undefined

  /* Drop the last refusal from the server as soon as anything is changed.
   *
   * A sentence must not outlive the input it was about: the server says an
   * address is taken, the administrator types a free one, and the message has to
   * go rather than wait for the next press of the button to be re-asked.
   *
   * Guarded, so an ordinary keystroke with nothing outstanding does not re-render
   * the form for nothing.
   */
  const verwerfeServerfehler = () => {
    if (anlegen.error !== null) anlegen.reset()
  }

  /* The region coupling, read live from the two fields it depends on, so which
     field is drawn and whether the form can be sent are one fact rather than two
     that can disagree. Zod cannot state it, because whether the number is required
     depends on another answer, so it lives in eingabe.ts and is applied from there.

     useWatch on those two rather than watch() over everything, which would
     re-render the form on every keystroke in every field. */
  const rollen = useWatch({ control, name: 'rollen' })
  const gewaehlteRegion = useWatch({ control, name: 'regierungspraesidium' })
  const regional = istRegional(rollen)

  /* Said only once the button has been pressed. Revealing the field and marking
     it wrong in the same instant would be telling somebody off for not having
     answered a question they have just been asked. */
  const zeigeFehlendeRegion = isSubmitted && fehltDieRegion(rollen, gewaehlteRegion)

  /* The browser's own message first, because it is the one that can appear without
     a round trip; the server's only when it has something else to say. */
  const regionMeldung = zeigeFehlendeRegion
    ? t('benutzerverwaltung.felder.fehlt.regierungspraesidium')
    : serverMeldung('regierungspraesidium')

  /* A refusal about the caller rather than about anything typed. Not an error to
     retry and not a message under a field, so it replaces the page, the same way
     the account list answers the same code. */
  if (anlegen.error instanceof ApiFehler && anlegen.error.code === ROLLE_FEHLT) {
    return <KeineBerechtigung />
  }

  return (
    <>
      <div className="page__head">
        <div>
          <Typography variant="h1">{t('benutzerverwaltung.anlegen.titel')}</Typography>
          <p className="page__sub">{t('benutzerverwaltung.anlegen.untertitel')}</p>
        </div>
      </div>

      <section className="card">
        {angelegt !== null ? (
          <div className="konto-anlegen__inhalt">
            <Zugangsdaten
              email={angelegt.email}
              passwort={angelegt.passwort}
              onWeiteres={() => {
                /* Everything, the password included. A form still holding the last
                   account's password would offer it as the next one's. */
                reset(LEERES_FORMULAR)
                anlegen.reset()
                setAngelegt(null)
                /* Nothing here moves the cursor: the address field's own autoFocus
                   does it when the form is mounted again. */
              }}
            />
          </div>
        ) : (
        /* noValidate, so the browser's own bubbles stay out of the way of the
           German messages this form places under each field. One opinion per
           field. */
        <form
          className="konto-anlegen__inhalt"
          noValidate
          /* Covers the two text fields and the six checkboxes in one place,
             because a real input's change event bubbles to the form.
             **The two dropdowns are not covered by this** and clear the refusal
             themselves: MUI's Select is a div with a hidden input and emits no
             change that arrives here, which a browser check caught as a stale
             message surviving a change of region. */
          onChange={verwerfeServerfehler}
          onSubmit={(ereignis) => {
            ereignis.preventDefault()
            void handleSubmit((formular) => {
              /* Null when the coupling is unsatisfied, which is the one rule Zod
                 cannot state because it depends on another field. Nothing is sent
                 and zeigeFehlendeRegion says why, under the control. */
              const eingabe = kontoEingabe(formular)
              if (eingabe === null) return

              anlegen.mutate(eingabe, {
                /* Taken from what was typed rather than from the answer, because
                   the answer deliberately carries no password. The address comes
                   from the server's copy, which is the normalised one: the account
                   is anna@ffs.de even where ANNA@FFS.de was typed, and showing the
                   typed spelling would have somebody pass on an address that is
                   not quite the account's own. */
                onSuccess: (konto) => {
                  setAngelegt({ email: konto.email, passwort: eingabe.passwort })
                },
              })
            })(ereignis)
          }}
        >
          <Kontofeld
            name="email"
            labelKey="benutzerverwaltung.felder.email"
            hinweisKey="benutzerverwaltung.felder.emailHinweis"
            autoComplete="off"
            autoFocus
            register={register}
            meldung={meldung(errors.email?.message) ?? serverMeldung('email')}
          />

          <Kontofeld
            name="passwort"
            labelKey="benutzerverwaltung.felder.passwort"
            hinweisKey="benutzerverwaltung.felder.passwortHinweis"
            /* new-password, so a password manager offers to store this one rather
               than filling in the administrator's own. */
            autoComplete="new-password"
            register={register}
            meldung={meldung(errors.passwort?.message) ?? serverMeldung('passwort')}
          />

          <Controller
            name="rollen"
            control={control}
            render={({ field }) => (
              <Rollenauswahl
                gewaehlt={field.value}
                onAendern={(rollen) => {
                  field.onChange(rollen)
                  /* A region left behind by a role that is no longer ticked would
                     reappear, already chosen, if somebody ticked the role again,
                     and would look like an answer they had given. kontoEingabe
                     keeps it out of the request either way; this keeps it off the
                     screen. */
                  if (!istRegional(rollen)) setValue('regierungspraesidium', '')
                }}
                meldung={meldung(errors.rollen?.message) ?? serverMeldung('rollen')}
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
                    verwerfeServerfehler()
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
                    verwerfeServerfehler()
                  }}
                  /* The control somebody reaches is a div with role="combobox",
                     not an input, so <label for> cannot name it. These two props
                     are the wiring that does; an id passed the ordinary way lands
                     on MUI's hidden input and leaves the real control nameless. */
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

          {/* Only what no field would carry: the network being down, or a code
              this build has never heard of. Anything about one answer is already
              under that answer. */}
          {serverText !== undefined && serverFeld === undefined && (
            <Alert severity="error" className="konto-anlegen__meldung">
              {serverText}
            </Alert>
          )}

          <div className="konto-anlegen__aktionen">
            <Button type="submit" variant="contained" disabled={anlegen.isPending}>
              {t(
                anlegen.isPending
                  ? 'benutzerverwaltung.anlegen.laeuft'
                  : 'benutzerverwaltung.anlegen.absenden',
              )}
            </Button>
            <Button component={Link} to={BENUTZERVERWALTUNG} variant="outlined">
              {t('benutzerverwaltung.anlegen.abbrechen')}
            </Button>
          </div>
        </form>
        )}
      </section>
    </>
  )
}

export default KontoAnlegenSeite
