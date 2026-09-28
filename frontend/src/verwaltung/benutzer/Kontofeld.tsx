import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import type { FieldValues, Path, UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { feldAria, fehlerId, hinweisId } from '../../protokoll/felder/rahmen'

/* One typed field of the new-account form, so the accessibility wiring is written
 * once rather than twice.
 *
 * The same arrangement AnmeldungSeite uses, and for the reason that page records:
 * its two fields were written out twice and had drifted apart before the review
 * that caught it. The aria attributes, the hint's id and the "-fehler" id all come
 * from protokoll/felder/rahmen.ts rather than being restated, because a label
 * association got wrong once is got wrong everywhere.
 *
 * FeldRahmen itself is not reused. It is typed to a path into the answers
 * document, and an account is not a protocol.
 *
 * **Generic over the form it belongs to**, widened in feature 16d. There are now
 * three: the create form, the edit form, which is the same form without the
 * password, and the new-password form, which is the password on its own. Copying
 * this component per form is exactly the drift it was extracted to prevent, and
 * the field name is the only thing that differs between the three.
 *
 * The name is also the control's id, so two of these on one page must not be given
 * the same name. On the edit screen they are 'email' and 'passwort', in two
 * separate forms, which is why the ids do not collide.
 */

interface KontofeldProps<T extends FieldValues> {
  name: Path<T>
  labelKey: ParseKeys
  hinweisKey?: ParseKeys
  autoComplete: string
  autoFocus?: boolean
  register: UseFormRegister<T>
  /** A key from the browser's own rules, already looked up by the caller. */
  meldung?: string
  /* Span both columns of the form's grid. The create form has two text fields
     side by side and needs this nowhere; the edit form has one, and without it
     the address sits in the left half with the right half empty. */
  breit?: boolean
}

function Kontofeld<T extends FieldValues>({
  name,
  labelKey,
  hinweisKey,
  autoComplete,
  autoFocus,
  register,
  meldung,
  breit = false,
}: KontofeldProps<T>) {
  const { t } = useTranslation()

  /* Masked to begin with, because somebody may well be standing behind the
     administrator, and revealable because they have to read it out afterwards.
     This is what replaces a second "repeat the password" field: being able to see
     what you typed catches a typo, where typing it twice blind only catches a
     disagreement between two attempts. */
  const [sichtbar, setSichtbar] = useState(false)
  const istPasswort = name === 'passwort'

  return (
    <FormControl
      error={Boolean(meldung)}
      className={breit ? 'konto-anlegen__feld konto-anlegen__feld--breit' : 'konto-anlegen__feld'}
    >
      {/* FormLabel inside a FormControl, never InputLabel and its border notch:
          the label sits above the field on this project. */}
      <FormLabel htmlFor={name}>{t(labelKey)}</FormLabel>

      {hinweisKey && (
        <FormHelperText id={hinweisId(name, true)} className="konto-anlegen__hinweis">
          {t(hinweisKey)}
        </FormHelperText>
      )}

      <OutlinedInput
        id={name}
        /* "text" rather than "email" even for the address. The browser's own
           validation bubble would appear beside a field whose message we have
           already written in German and placed underneath it, and the two disagree
           about what an address is: Chrome refuses an umlaut domain the backend
           accepts. One opinion per field. */
        type={istPasswort && !sichtbar ? 'password' : 'text'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        {...register(name)}
        /* Through the input's own slot, never spread onto the component. Anything
           MUI does not recognise lands on the wrapper element instead, which is
           where aria-required ended up when this was written the other way: on a
           div that names nothing and is announced to nobody. Every other field on
           this project passes the helper the same way, AnmeldungSeite and FeldText
           included. */
        slotProps={{ input: feldAria(name, true, hinweisKey, meldung ? labelKey : undefined) }}
        endAdornment={
          istPasswort ? (
            <InputAdornment position="end">
              {/* A named button rather than an icon. No icon package is installed,
                  and a control announcing itself as "Passwort anzeigen" is better
                  than one announcing itself as an eye. */}
              <Button
                type="button"
                size="small"
                variant="text"
                onClick={() => setSichtbar((vorher) => !vorher)}
              >
                {t(
                  sichtbar
                    ? 'benutzerverwaltung.felder.passwortVerbergen'
                    : 'benutzerverwaltung.felder.passwortAnzeigen',
                )}
              </Button>
            </InputAdornment>
          ) : undefined
        }
      />

      {meldung && (
        <FormHelperText id={fehlerId(name, true)} role="alert">
          {meldung}
        </FormHelperText>
      )}
    </FormControl>
  )
}

export default Kontofeld
