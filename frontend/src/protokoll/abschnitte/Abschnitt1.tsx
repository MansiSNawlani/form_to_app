import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Antworten } from '../entwurf/typen'
import { optionen } from '../optionen'

/* Section 1: Anlass, Bearbeiter and Probestrecke.

   Feature 4b adds the Bearbeiter and Probestrecke blocks and the rest of the
   Anlass block (Monitoringstrecken-Nr., Regierungspräsidium, Datum, Uhrzeit).
   Only the Anlass dropdown is here, as the one field that proves a value chosen
   in the form reaches storage and comes back.

   The field is registered under its legacy PDF path, "anlass". Every field from
   4b on does the same, which is what keeps the stored document a direct match
   for what FiaKa already receives.

   Controller rather than register, because MUI's Select is a controlled
   component and does not expose a native input for React Hook Form to attach
   to. Its list of options comes from the extracted form definition, never from
   values retyped here. */
function Abschnitt1() {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt1.anlass.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt1.anlass.hinweis')}
      </p>

      <div className="grid">
        <FormControl className="field col-5" required fullWidth>
          <FormLabel htmlFor="anlass">
            {t('protokoll.abschnitt1.anlass.label')}
          </FormLabel>
          <Controller
            name="anlass"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                // A draft's answer is undefined until it is given, and switching
                // an input from uncontrolled to controlled mid-life is a React
                // error, so the empty option stands in for "not answered".
                value={field.value ?? ''}
                id="anlass"
                displayEmpty
                inputProps={{ 'aria-required': true }}
              >
                <MenuItem value="">{t('protokoll.felder.bitteWaehlen')}</MenuItem>
                {optionen('anlass').map((option) => (
                  <MenuItem key={option.wert} value={option.wert}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </FormControl>
      </div>
    </fieldset>
  )
}

export default Abschnitt1
