import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { beschriebenVon, labelId, type FeldRahmenProps } from './rahmen'
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
  const fehlerKey = useFeldFehler(name)

  return (
    <FeldRahmen
      id={name}
      labelKey={labelKey}
      spalten={spalten}
      pflicht={pflicht}
      hinweisKey={hinweisKey}
      fehlerKey={fehlerKey}
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
            displayEmpty
            /* The control the user reaches is a div with role="combobox", not
               an input, so <label for> cannot name it and these three props are
               the only wiring that does. An id passed the ordinary way would
               land on MUI's hidden aria-hidden input instead, leaving the real
               control nameless, so the visible element is given the field path
               through SelectDisplayProps. */
            labelId={labelId(name)}
            SelectDisplayProps={{ id: name }}
            required={pflicht}
            aria-invalid={fehlerKey ? true : undefined}
            aria-describedby={beschriebenVon(name, hinweisKey, fehlerKey)}
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
