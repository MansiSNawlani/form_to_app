import { useTranslation } from 'react-i18next'
import FeldText from './FeldText'
import type { Spalten } from './rahmen'
import type { ParseKeys } from 'i18next'
import type { AntwortPfad } from '../entwurf/typen'

/* One share of a whole, in percent. Part 3 has forty-three of them.

   A wrapper around FeldText rather than a control of its own, so the label
   association, the hint and the error surface live in exactly one place for all
   338 fields. All this adds is the unit and the bounds.

   The bounds are an affordance, not a rule. min, max and step tell the browser
   what kind of value this is and stop the spinner running past it; nothing here
   rejects a pasted 250. The rule that catches that is the sum-to-100 check in
   feature 6b, which is also where a block gets its required marker. A single
   share is never required on its own. */

interface FeldProzentProps {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  labelKey: ParseKeys
  spalten: Spalten
}

function FeldProzent({ name, labelKey, spalten }: FeldProzentProps) {
  const { t } = useTranslation()

  return (
    <FeldText
      name={name}
      typ="number"
      bereich={{ min: 0, max: 100, step: 1 }}
      einheit={t('protokoll.felder.einheit.prozent')}
      labelKey={labelKey}
      spalten={spalten}
    />
  )
}

export default FeldProzent
