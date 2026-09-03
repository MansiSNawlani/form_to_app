import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { ParseKeys } from 'i18next'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Spalten } from './rahmen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* A single yes-or-no observation, ticked or not.

   No FeldRahmen around it, unlike every other control. Its label belongs beside
   the box rather than above it, so the frame's label-above-the-control would put
   a heading over an unlabelled box.

   It appears in three places. Inside a FeldRadio's row, qualifying the group it
   sits in, which is where part 2's four live. Loose in a row of its own, as
   part 3's Besonderheiten are. And as one cell of a grid row beside labelled
   fields, which is what spalten is for: without it the caller has to hand-build
   a positioning wrapper, and the alignment gets solved differently every time.

   "Ja" rather than true, because "Ja" is what the PDF exports and what FiaKa
   receives, and because every value in the answers document is a string. Not
   ticked is the empty string, matching how a cleared text field is stored. */

const GESETZT = 'Ja'

interface FeldHakenProps {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  labelKey: ParseKeys
  /* Grid columns, when this sits in a .grid row rather than inside another
     control. Left out when the row around it does the placing. */
  spalten?: Spalten
}

function FeldHaken({ name, labelKey, spalten }: FeldHakenProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()

  const haken = (
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

  /* Bottom-aligned in its cell, because the fields beside it carry a label
     above the control and a checkbox level with those labels reads as belonging
     to them rather than standing on its own. */
  if (!spalten) return haken
  return <div className={`field field--haken col-${spalten}`}>{haken}</div>
}

export default FeldHaken
