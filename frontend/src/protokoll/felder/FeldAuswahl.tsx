import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldRahmen from './FeldRahmen'
import { hinweisId, type FeldRahmenProps } from './rahmen'
import { optionen, type ListenName } from '../optionen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* A dropdown over one of the option lists extracted from the legacy PDF.

   The list is named, never passed in as an array, so a wrong name is a build
   error rather than an empty dropdown, and no option value is ever retyped into
   a component. What gets stored is the export value the PDF uses, because that
   is what FiaKa receives today; the label is only ever shown.

   Controller rather than register, because MUI's Select is controlled and
   exposes no native input for React Hook Form to attach to. */

interface FeldAuswahlProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  liste: ListenName
  /* Shows the stored code in front of the label, as in "14 - Fluss". On for the
     Gewaessertyp, whose codes CONTEXT.md and the form's own hints both talk in;
     off where the code means nothing to the reader. */
  mitWert?: boolean
}

function FeldAuswahl({
  name,
  liste,
  mitWert,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldAuswahlProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()

  return (
    <FeldRahmen
      id={name}
      labelKey={labelKey}
      spalten={spalten}
      pflicht={pflicht}
      hinweisKey={hinweisKey}
    >
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            // A draft's answer is undefined until it is given, and switching an
            // input from uncontrolled to controlled mid-life is a React error,
            // so the empty option stands in for "not answered".
            value={field.value ?? ''}
            id={name}
            displayEmpty
            inputProps={{
              'aria-required': pflicht,
              'aria-describedby': hinweisId(name, hinweisKey),
            }}
          >
            <MenuItem value="">{t('protokoll.felder.bitteWaehlen')}</MenuItem>
            {optionen(liste).map((option) => (
              <MenuItem key={option.wert} value={option.wert}>
                {mitWert ? `${option.wert} - ${option.label}` : option.label}
              </MenuItem>
            ))}
          </Select>
        )}
      />
    </FeldRahmen>
  )
}

export default FeldAuswahl
