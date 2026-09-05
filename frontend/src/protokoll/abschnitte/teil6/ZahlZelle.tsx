import OutlinedInput from '@mui/material/OutlinedInput'
import { useFormContext } from 'react-hook-form'
import { useFeldFehler } from '../../felder/fehler'
import { fehlerId } from '../../felder/rahmen'
import type { Antworten, AntwortPfad } from '../../entwurf/typen'

/* One count in the catch table: a size class, or the young-of-year column.
 *
 * Not a FeldText, and the difference is the whole reason this file exists. Every
 * control in the Feld* family sits in a FeldRahmen, which draws a label above
 * it. A table cell is not labelled that way: its name comes from the column
 * heading a sighted user reads across to. Wrapping FeldRahmen here would put 260
 * visible labels inside the grid and say each size class eleven times.
 *
 * So the name is given as aria-label instead, and it is built by the caller from
 * the row and the column, "Art 3, über 10 bis 15 cm". That matters more here
 * than anywhere else on the protocol: a screen reader user never sees the
 * heading, and without it these are 260 identical unnamed number boxes.
 *
 * Registered rather than controlled, like FeldText and for the same reason.
 * register hands the input to React Hook Form's own ref, so a keystroke
 * re-renders nothing. At 312 controls in one section that is not an
 * optimisation, it is whether the section is usable.
 */

interface ZahlZelleProps {
  name: AntwortPfad
  /** The control's whole accessible name, since no visible label points at it. */
  bezeichnung: string
}

function ZahlZelle({ name, bezeichnung }: ZahlZelleProps) {
  const { register } = useFormContext<Antworten>()
  const { ref, ...feld } = register(name)
  const fehlerKey = useFeldFehler(name)

  return (
    <OutlinedInput
      {...feld}
      inputRef={ref}
      id={name}
      type="number"
      className="zelle__eingabe"
      inputProps={{
        /* A count of fish. No decimals, and no ceiling anyone can name: what
           counts as too many Rotaugen is a question for FFS, and guessing it
           would put a limit in the interface that no rule backs. The floor is an
           affordance only, since the browser will not stop a pasted value;
           feature 9b holds the answer to it. */
        min: 0,
        step: 1,
        'aria-label': bezeichnung,
        'aria-invalid': fehlerKey ? true : undefined,
        'aria-describedby': fehlerId(name, Boolean(fehlerKey)),
      }}
    />
  )
}

export default ZahlZelle
