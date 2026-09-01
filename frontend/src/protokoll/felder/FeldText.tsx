import OutlinedInput from '@mui/material/OutlinedInput'
import { useFormContext } from 'react-hook-form'
import FeldRahmen from './FeldRahmen'
import { feldAria, type FeldRahmenProps } from './rahmen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* Every typed-in answer on the protocol: text, numbers, a date, a time, an
   e-mail address, a telephone number.

   Registered rather than controlled. register hands the input straight to React
   Hook Form's own ref, so a keystroke re-renders nothing at all. At 338 fields
   that is the difference between typing that keeps up and typing that does not,
   which is why coding-standards.md rules out useState and a context here.

   OutlinedInput rather than TextField: TextField brings its own FormControl and
   label, and nesting that inside FeldRahmen's would break both the label
   association and the required flag. This is the same MUI input either way,
   without the wrapper we already have. */

type Eingabetyp = 'text' | 'number' | 'date' | 'time' | 'email' | 'tel'

interface FeldTextProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  typ?: Eingabetyp
  /** A unit shown beside the control, such as the m after a stretch length. */
  einheit?: string
}

function FeldText({
  name,
  typ = 'text',
  einheit,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldTextProps) {
  const { register } = useFormContext<Antworten>()
  const { ref, ...feld } = register(name)

  const eingabe = (
    <OutlinedInput
      {...feld}
      inputRef={ref}
      id={name}
      type={typ}
      fullWidth
      inputProps={feldAria(name, pflicht, hinweisKey)}
    />
  )

  return (
    <FeldRahmen
      id={name}
      labelFuer={name}
      labelKey={labelKey}
      spalten={spalten}
      pflicht={pflicht}
      hinweisKey={hinweisKey}
    >
      {einheit ? (
        <div className="unit-row">
          {eingabe}
          <span className="unit-row__unit">{einheit}</span>
        </div>
      ) : (
        eingabe
      )}
    </FeldRahmen>
  )
}

export default FeldText
