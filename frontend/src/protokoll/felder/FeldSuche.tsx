import Autocomplete from '@mui/material/Autocomplete'
import OutlinedInput from '@mui/material/OutlinedInput'
import { Controller, useFormContext } from 'react-hook-form'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { feldAria, type FeldRahmenProps } from './rahmen'
import { optionen, type ListenName } from '../optionen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The same thing as FeldAuswahl, for a list too long to scroll.

   The Monitoringstrecken-Nr. has 722 entries and the species list has 123, so a
   dropdown is unusable and a search is the only workable control. What is stored
   is still the export value, not the label the user typed against. */

interface FeldSucheProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  liste: ListenName
}

function FeldSuche({
  name,
  liste,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldSucheProps) {
  const { control } = useFormContext<Antworten>()
  const alle = optionen(liste)
  const fehlerKey = useFeldFehler(name)

  return (
    <FeldRahmen
      id={name}
      labelFuer={name}
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
          <Autocomplete
            id={name}
            options={alle}
            /* Autocomplete works in options, the draft stores an export value,
               so the stored value is looked back up here. null, not undefined,
               because undefined would make the control uncontrolled. */
            value={alle.find((option) => option.wert === field.value) ?? null}
            onChange={(_, option) => field.onChange(option?.wert ?? '')}
            onBlur={field.onBlur}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, gewaehlt) =>
              option.wert === gewaehlt.wert
            }
            // So Enter picks the first match instead of doing nothing, which is
            // what makes the control usable without a mouse.
            autoHighlight
            /* OutlinedInput rather than MUI's own TextField example, for the
               same reason as FeldText: TextField brings a second FormControl
               and label that would fight FeldRahmen's. */
            renderInput={({ slotProps }) => (
              <OutlinedInput
                {...slotProps.input}
                inputProps={{
                  ...slotProps.htmlInput,
                  ...feldAria(name, pflicht, hinweisKey, fehlerKey),
                }}
                fullWidth
              />
            )}
          />
        )}
      />
    </FeldRahmen>
  )
}

export default FeldSuche
