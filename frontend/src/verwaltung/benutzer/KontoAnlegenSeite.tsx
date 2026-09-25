import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
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
import { useFehlertext } from '../../api/useFehlertext'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'
import { optionen } from '../../protokoll/optionen'
import { fehlerId, labelId } from '../../protokoll/felder/rahmen'
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
import Rollenauswahl from './Rollenauswahl'
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

/** The two locales the backend's Locale enum offers. */
const SPRACHEN = ['de', 'en'] as const

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

  /* The schema's messages are translation keys rather than sentences, so that
     eingabe.ts stays a plain module with no i18n in it and can be tested without
     one. This is where they become German. */
  const meldung = (schluessel?: string) => (schluessel ? t(schluessel as ParseKeys) : undefined)

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

  /* The region coupling, read from the live answers rather than held as state of
     its own. Two facts that could otherwise disagree are one fact here: which
     field is drawn, and whether the form can be sent.

     Zod cannot express this, because whether the number is required depends on
     another field, so it lives in eingabe.ts as a plain function and is applied in
     both places from there. */
  /* useWatch on the two fields the coupling reads, rather than watch() over the
     whole form. watch() re-renders this component on every keystroke in every
     field, which is the habit coding-standards.md warns about at 338 fields and is
     no more correct at five, and the React compiler cannot memoize around it. */
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
    ? t('benutzerverwaltung.anlegen.fehlt.regierungspraesidium')
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
                /* By id rather than through a ref. The field's id is fixed and
                   ours, because its label points at it with htmlFor, and React
                   Hook Form's own ref lands on MUI's wrapper rather than on the
                   input underneath it. Without this the cursor would be left on a
                   button that has just been replaced. */
                document.getElementById('email')?.focus()
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
            labelKey="benutzerverwaltung.anlegen.email"
            hinweisKey="benutzerverwaltung.anlegen.emailHinweis"
            autoComplete="off"
            autoFocus
            register={register}
            meldung={meldung(errors.email?.message) ?? serverMeldung('email')}
          />

          <Kontofeld
            name="passwort"
            labelKey="benutzerverwaltung.anlegen.passwort"
            hinweisKey="benutzerverwaltung.anlegen.passwortHinweis"
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
            <FormControl
              className="konto-anlegen__feld"
              error={Boolean(regionMeldung)}
              required
            >
              <FormLabel id={labelId('regierungspraesidium')} htmlFor="regierungspraesidium">
                {t('benutzerverwaltung.anlegen.regierungspraesidium')}
              </FormLabel>
              <Controller
                name="regierungspraesidium"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    displayEmpty
                    labelId={labelId('regierungspraesidium')}
                    SelectDisplayProps={{ id: 'regierungspraesidium' }}
                    aria-invalid={regionMeldung ? true : undefined}
                    aria-describedby={
                      regionMeldung ? fehlerId('regierungspraesidium', true) : undefined
                    }
                  >
                    <MenuItem value="">{t('protokoll.felder.bitteWaehlen')}</MenuItem>
                    {/* The four regions out of the list extracted from the legacy
                        form, never retyped here. The number is what FiaKa
                        receives, so the form is the authority on what it means,
                        and feature 16c step 1 corrected the one hand-written copy
                        that disagreed. */}
                    {optionen('z.rp').map((option) => (
                      <MenuItem key={option.wert} value={option.wert}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {regionMeldung && (
                <FormHelperText id={fehlerId('regierungspraesidium', true)} role="alert">
                  {regionMeldung}
                </FormHelperText>
              )}
            </FormControl>
          )}

          <FormControl className="konto-anlegen__feld">
            <FormLabel id={labelId('locale')} htmlFor="locale">
              {t('benutzerverwaltung.anlegen.sprache')}
            </FormLabel>
            <Controller
              name="locale"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  /* The control somebody reaches is a div with role="combobox",
                     not an input, so <label for> cannot name it. These two props
                     are the wiring that does; an id passed the ordinary way lands
                     on MUI's hidden input and leaves the real control nameless. */
                  labelId={labelId('locale')}
                  SelectDisplayProps={{ id: 'locale' }}
                >
                  {SPRACHEN.map((sprache) => (
                    <MenuItem key={sprache} value={sprache}>
                      {t(`benutzerverwaltung.anlegen.sprachen.${sprache}` satisfies ParseKeys)}
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
