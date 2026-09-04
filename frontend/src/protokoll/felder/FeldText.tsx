import OutlinedInput from '@mui/material/OutlinedInput'
import { useFormContext } from 'react-hook-form'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { feldAria, type FeldRahmenProps } from './rahmen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* Every typed-in answer on the protocol: text, numbers, an e-mail address, a
   telephone number. Dates and times have their own component, FeldDatum.

   Registered rather than controlled. register hands the input straight to React
   Hook Form's own ref, so a keystroke re-renders nothing at all. At 338 fields
   that is the difference between typing that keeps up and typing that does not,
   which is why coding-standards.md rules out useState and a context here.

   OutlinedInput rather than TextField: TextField brings its own FormControl and
   label, and nesting that inside FeldRahmen's would break both the label
   association and the required flag. This is the same MUI input either way,
   without the wrapper we already have. */

type Eingabetyp = 'text' | 'number' | 'email' | 'tel'

interface FeldTextProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  typ?: Eingabetyp
  /** A unit shown beside the control, such as the m after a stretch length. */
  einheit?: string
  /* What a number input's spinner may reach, for a field with a natural range
     such as a percentage. An affordance only: the browser will not stop a
     pasted value, so anything that must be true of the answer is a rule in
     regeln/ as well. */
  bereich?: { min: number; max: number; step: number }
  /* How many lines tall the box starts, for the few answers the printed form
     gives several writing lines to: the Fischereiausübungsberechtigter's contact
     details and the two remarks boxes. Left out everywhere else, which is the
     ordinary single-line input. It grows past this as the answer does. */
  zeilen?: number
}

function FeldText({
  name,
  typ = 'text',
  einheit,
  bereich,
  zeilen,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldTextProps) {
  const { register } = useFormContext<Antworten>()
  const { ref, ...feld } = register(name)
  const fehlerKey = useFeldFehler(name)

  const eingabe = (
    <OutlinedInput
      {...feld}
      inputRef={ref}
      id={name}
      /* A textarea has no type attribute, so passing one would put invalid
         markup on the page for the sake of a default that means nothing there. */
      type={zeilen ? undefined : typ}
      multiline={zeilen ? true : undefined}
      minRows={zeilen}
      fullWidth
      inputProps={{ ...bereich, ...feldAria(name, pflicht, hinweisKey, fehlerKey) }}
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
      fehlerKey={fehlerKey}
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
