import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { feldAria, fehlerId, hinweisId } from '../../protokoll/felder/rahmen'
import type { Kontoformular } from './eingabe'

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
 */

interface KontofeldProps {
  name: 'email' | 'passwort'
  labelKey: ParseKeys
  hinweisKey?: ParseKeys
  autoComplete: string
  autoFocus?: boolean
  register: UseFormRegister<Kontoformular>
  /** A key from the browser's own rules, already looked up by the caller. */
  meldung?: string
}

function Kontofeld({
  name,
  labelKey,
  hinweisKey,
  autoComplete,
  autoFocus,
  register,
  meldung,
}: KontofeldProps) {
  const { t } = useTranslation()

  /* Masked to begin with, because somebody may well be standing behind the
     administrator, and revealable because they have to read it out afterwards.
     This is what replaces a second "repeat the password" field: being able to see
     what you typed catches a typo, where typing it twice blind only catches a
     disagreement between two attempts. */
  const [sichtbar, setSichtbar] = useState(false)
  const istPasswort = name === 'passwort'

  return (
    <FormControl error={Boolean(meldung)} className="konto-anlegen__feld">
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
        {...feldAria(name, true, hinweisKey, meldung ? labelKey : undefined)}
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
                    ? 'benutzerverwaltung.anlegen.passwortVerbergen'
                    : 'benutzerverwaltung.anlegen.passwortAnzeigen',
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
