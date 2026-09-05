import Autocomplete from '@mui/material/Autocomplete'
import OutlinedInput from '@mui/material/OutlinedInput'
import { Controller, useFormContext } from 'react-hook-form'
import { optionen, type ListenName } from '../optionen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The search control itself, without anything that names it.
 *
 * Two callers, and they name it in incompatible ways. FeldSuche wraps it in a
 * FeldRahmen, which draws a visible label above the control, the shape every
 * ordinary field on the protocol has. Part 6's ArtZelle puts it in a table cell,
 * where the name comes from the column heading and a label drawn above would be
 * repeated twenty-six times down the grid.
 *
 * Everything else about the control is identical between them, so it lives here
 * once: what is stored is the export value rather than the label the user typed
 * against, and Enter picks the highlighted match so the control works without a
 * mouse.
 *
 * Split out during feature 9a, when ArtZelle would otherwise have been a
 * twenty-line copy of FeldSuche.
 */

/* What names the real input, which is the one thing the two callers do
   differently. FeldSuche passes feldAria, pointing at its own visible label and
   hint; ArtZelle passes an aria-label it builds from the row and the column. */
export interface EingabeAria {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

interface SucheProps {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  liste: ListenName
  eingabeAria: EingabeAria
  className?: string
}

function Suche({ name, liste, eingabeAria, className }: SucheProps) {
  const { control } = useFormContext<Antworten>()
  const alle = optionen(liste)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete
          id={name}
          options={alle}
          /* Autocomplete works in options, the draft stores an export value, so
             the stored value is looked back up here. null, not undefined,
             because undefined would make the control uncontrolled. */
          value={alle.find((option) => option.wert === field.value) ?? null}
          onChange={(_, option) => field.onChange(option?.wert ?? '')}
          onBlur={field.onBlur}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, gewaehlt) => option.wert === gewaehlt.wert}
          // So Enter picks the first match instead of doing nothing, which is
          // what makes the control usable without a mouse.
          autoHighlight
          className={className}
          /* OutlinedInput rather than MUI's own TextField example: TextField
             brings a second FormControl and label, which would fight FeldRahmen's
             in one caller and appear from nowhere in the other. */
          renderInput={({ slotProps }) => (
            <OutlinedInput
              {...slotProps.input}
              inputProps={{ ...slotProps.htmlInput, ...eingabeAria }}
              fullWidth
            />
          )}
        />
      )}
    />
  )
}

export default Suche
