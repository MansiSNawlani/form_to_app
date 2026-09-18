import Autocomplete from '@mui/material/Autocomplete'
import OutlinedInput from '@mui/material/OutlinedInput'
import { optionen, type ListenName, type Option } from '../optionen'

/* A search over one of the form's option lists, as a plain controlled field.
 *
 * Split out of Suche.tsx during feature 12c. Everything here was already there;
 * what moved away is the react-hook-form Controller around it. The review
 * queue's species filter is the same control over the same 123 entry list, but
 * it lives in a filter bar with no form anywhere near it, and a control that
 * insists on a useFormContext cannot be used outside one.
 *
 * So this knows nothing about where its value is kept. The protocol keeps it in
 * the draft through Suche.tsx; the Pruefliste keeps it in the address bar.
 */

/* What names the real input. The callers do this differently: FeldSuche points
   at its own visible label and hint, ArtZelle builds an aria-label from the row
   and the column, and the filter bar points at the FormLabel above it. */
export interface EingabeAria {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

interface OptionssucheProps {
  /** The control's id, which is also what a label's htmlFor has to name. */
  id: string
  liste: ListenName
  /** The stored export value, or null or "" for nothing chosen. */
  wert: string | null
  /** The chosen export value, or null when the reader cleared the control. */
  onWaehlen: (wert: string | null) => void
  onBlur?: () => void
  eingabeAria: EingabeAria
  /* Shown while nothing is chosen. The filter bar says "Alle Arten" there, so an
     unset species reads the way the Alle entry does in the dropdowns beside it.
     A field on the protocol leaves it off: an empty answer is empty, and a word
     in the box would look like one. */
  platzhalter?: string
  className?: string
  /* Draws the error look muiTheme.ts defines for every field. FeldSuche leaves
     it off, because FeldRahmen already puts the state on the FormControl around
     it; ArtZelle has no frame and needs it on the control itself. */
  fehlerhaft?: boolean
}

/* A code the list does not carry, as an option that at least names it. */
function unbekannt(wert: string | null): Option | null {
  return wert === null || wert === '' ? null : { wert, label: wert }
}

function Optionssuche({
  id,
  liste,
  wert,
  onWaehlen,
  onBlur,
  eingabeAria,
  platzhalter,
  className,
  fehlerhaft,
}: OptionssucheProps) {
  const alle = optionen(liste)

  return (
    <Autocomplete
      id={id}
      options={alle}
      /* Autocomplete works in options, everything storing a value stores the
         export code, so the code is looked back up here. null, not undefined,
         because undefined would make the control uncontrolled.

         A code with no entry in the list becomes an option showing the code
         itself rather than nothing. It happens when an address is typed by hand,
         and it will happen for real once a protocol frozen on an older form
         version names a code the current list has dropped: ADR 0004 keeps those
         protocols exactly as they were filed. Falling back to null would leave
         the control saying nothing is chosen while the list beneath it is
         narrowed, which reads as a screen showing the wrong number of rows. */
      value={alle.find((option) => option.wert === wert) ?? unbekannt(wert)}
      onChange={(_, option) => onWaehlen(option?.wert ?? null)}
      onBlur={onBlur}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, gewaehlt) => option.wert === gewaehlt.wert}
      // So Enter picks the first match instead of doing nothing, which is
      // what makes the control usable without a mouse.
      autoHighlight
      className={className}
      /* OutlinedInput rather than MUI's own TextField example: TextField brings a
         second FormControl and label, which would fight the FormControl every
         caller already draws around this. */
      renderInput={({ slotProps }) => (
        <OutlinedInput
          {...slotProps.input}
          inputProps={{ ...slotProps.htmlInput, ...eingabeAria }}
          placeholder={platzhalter}
          error={fehlerhaft}
          fullWidth
        />
      )}
    />
  )
}

export default Optionssuche
