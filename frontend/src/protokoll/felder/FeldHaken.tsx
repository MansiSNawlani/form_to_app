import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { ParseKeys } from 'i18next'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* A single yes-or-no observation, ticked or not.

   No FeldRahmen around it, unlike every other control. Its label belongs beside
   the box rather than above it, and the four that exist so far all sit inside a
   FeldRadio's row, which already carries the frame, the hint and the error
   message for the group they qualify.

   "Ja" rather than true, because "Ja" is what the PDF exports and what FiaKa
   receives, and because every value in the answers document is a string. Not
   ticked is the empty string, matching how a cleared text field is stored. */

const GESETZT = 'Ja'

interface FeldHakenProps {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  labelKey: ParseKeys
}

function FeldHaken({ name, labelKey }: FeldHakenProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          control={
            <Checkbox
              {...field}
              id={name}
              checked={field.value === GESETZT}
              onChange={(event) =>
                field.onChange(event.target.checked ? GESETZT : '')
              }
            />
          }
          label={t(labelKey)}
        />
      )}
    />
  )
}

export default FeldHaken
