import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import type { ReactNode } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { beschriebenVon, labelId, type FeldRahmenProps } from './rahmen'
import { optionen, type ListenName } from '../optionen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* One choice out of a handful, shown as a row of buttons rather than folded into
   a dropdown.

   Which of the two a field gets follows the legacy form: it prints these as
   buttons because a surveyor comparing "gleichmäßig tief" against "stark
   wechselnd" needs to see both at once, and reads the Gewaessertyp out of a list
   because eight long names do not fit a row. Part 2 is the first section built
   from buttons, and parts 3 to 6 are mostly more of them.

   The list is named, never passed in as an array, exactly as FeldAuswahl does
   it, so a wrong name is a build error rather than an empty group and no option
   value is ever retyped into a component.

   Controller rather than register: a RadioGroup is controlled and has no single
   native input for React Hook Form to attach a ref to. */

interface FeldRadioProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the group's id. */
  name: AntwortPfad
  liste: ListenName
  /** A unit shown after the options, such as the m after the width bands. */
  einheit?: string
  /* Controls that sit in the same row as the options without being options.
     Three hydrology groups end in a checkbox on the printed form: a stretch can
     be evenly deep and also have pools. They go here rather than into the group
     because a checkbox inside a radiogroup is a lie to a screen reader. */
  children?: ReactNode
}

function FeldRadio({
  name,
  liste,
  einheit,
  children,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldRadioProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()
  const fehlerKey = useFeldFehler(name)
  const aufhebenId = `${name}-aufheben`

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
          <div className="options">
            <RadioGroup
              {...field}
              row
              // Undefined until the field is answered, and switching an input
              // from uncontrolled to controlled mid-life is a React error, so
              // the empty string stands in for "not answered".
              value={field.value ?? ''}
              /* The group is a div, not an input, so <label for> cannot reach
                 it and these are the only wiring that names it. The label id is
                 the same one FeldRahmen puts on its FormLabel. */
              aria-labelledby={labelId(name)}
              aria-required={pflicht}
              aria-invalid={fehlerKey ? true : undefined}
              aria-describedby={beschriebenVon(name, hinweisKey, fehlerKey)}
            >
              {optionen(liste).map((option) => (
                <FormControlLabel
                  key={option.wert}
                  value={option.wert}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
            {/* Outside the group, not inside it: a unit is not a further option
                and should not be counted as one when the group is announced. */}
            {einheit && <span className="options__unit">{einheit}</span>}
            {children}
            {/* A dropdown has "Bitte wählen" at the top, so part 1 can always be
                put back to no answer. A radio group has no way back to nothing
                once a button is pressed, and on a protocol filled in over
                several sittings a mis-clicked band would otherwise have to stay
                wrong rather than become unanswered again. Shown only when there
                is something to undo, so an untouched form is not littered with
                it. */}
            {field.value ? (
              <Button
                variant="text"
                size="small"
                /* Section 2 shows twelve of these. Named by its own text plus
                   the group's label, so a screen reader reads "Auswahl aufheben
                   mittlere Breite" rather than the same three words twelve times
                   with nothing to say which band they clear. */
                id={aufhebenId}
                aria-labelledby={`${aufhebenId} ${labelId(name)}`}
                onClick={() => field.onChange('')}
              >
                {t('protokoll.felder.auswahlAufheben')}
              </Button>
            ) : null}
          </div>
        )}
      />
    </FeldRahmen>
  )
}

export default FeldRadio
