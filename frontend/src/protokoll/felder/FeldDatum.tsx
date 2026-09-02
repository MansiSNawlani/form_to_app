import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs from 'dayjs'
import { Controller, useFormContext } from 'react-hook-form'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { beschriebenVon, labelId, type FeldRahmenProps } from './rahmen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The date and the time of the Befischung.

   MUI's pickers rather than a native date input, so the format is German
   whatever language the browser is set to. DatumsProvider says more about why.

   What is stored does not change: the draft holds the same ISO strings the
   native inputs produced, because every answer in the document is a string and
   the eventual FiaKa transfer reads them as text. The date object exists only
   between the picker and this component. */

const FORMAT = { datum: 'YYYY-MM-DD', uhrzeit: 'HH:mm' } as const

interface FeldDatumProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  art: keyof typeof FORMAT
}

function FeldDatum({
  name,
  art,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldDatumProps) {
  const { control } = useFormContext<Antworten>()
  const format = FORMAT[art]
  const Picker = art === 'datum' ? DatePicker : TimePicker
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
          <Picker
            /* null, not undefined: an unanswered field would otherwise switch
               the picker from uncontrolled to controlled the moment it is
               answered, which React treats as an error. */
            value={field.value ? dayjs(field.value, format) : null}
            /* A half-typed date is not a date, so it is stored as empty rather
               than as the picker's Invalid Date. */
            onChange={(wert) =>
              field.onChange(wert?.isValid() ? wert.format(format) : '')
            }
            format={format === FORMAT.datum ? 'DD.MM.YYYY' : 'HH:mm'}
            /* Five minute steps, kept by decision on 2026-09-01. It happens to
               be MUI's default, but it is pinned here so a later version of the
               library cannot change it underneath us. The clock therefore
               offers twelve of the sixty minutes; the legacy PDF held the time
               as free text, so anyone needing an exact minute types it into the
               field instead. On the list to confirm with FFS. */
            timeSteps={{ minutes: 5 }}
            slotProps={{
              textField: {
                id: name,
                fullWidth: true,
                required: pflicht,
                onBlur: field.onBlur,
                /* The control a screen reader meets is the role="group" holding
                   the day, month and year spinbuttons, not an input, so it has
                   to be named by reference. MUI points it at the label of its
                   own floating InputLabel, which we do not render, and these
                   props are spread after that default, so they win. */
                error: Boolean(fehlerKey),
                slotProps: {
                  input: {
                    'aria-labelledby': labelId(name),
                    'aria-describedby': beschriebenVon(
                      name,
                      hinweisKey,
                      fehlerKey,
                    ),
                    'aria-required': pflicht,
                    'aria-invalid': fehlerKey ? true : undefined,
                  },
                },
              },
            }}
          />
        )}
      />
    </FeldRahmen>
  )
}

export default FeldDatum
