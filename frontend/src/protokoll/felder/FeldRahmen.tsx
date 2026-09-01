import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import type { ParseKeys } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fehlerId, hinweisId, labelId, type FeldRahmenProps } from './rahmen'

/* What every field on the protocol has in common: a grid column, a label above
   the control, and an optional hint below it.

   Held in one place because the form has roughly 338 fields. A label
   association or a required marker got wrong here is got wrong once, not three
   hundred times, and accessibility is an acceptance criterion on every UI
   feature rather than a later pass. */
function FeldRahmen({
  id,
  labelFuer,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
  fehlerKey,
  children,
}: FeldRahmenProps & {
  /* What is wrong with this answer, as a key out of de.json. Recomputed from
     the answers on every change, never stored: an invalid draft is saved like
     any other, and the rules run again when it is opened. */
  fehlerKey?: ParseKeys
  /* The id of a control that <label for> can actually reach, which means a
     real input. Left out for a control that is a div underneath, such as MUI's
     Select, where the only way to give a name is aria-labelledby pointing back
     at the label's own id. */
  labelFuer?: string
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <FormControl
      className={`field col-${spalten}`}
      required={pflicht}
      /* Carries the error state down to the label, the control and the message
         through MUI's own FormControl context, which is why none of them needs
         telling separately. */
      error={Boolean(fehlerKey)}
      fullWidth
    >
      {/* FormLabel, not InputLabel: the mockups put a small bold label above the
          field rather than floating it into the border notch. FormLabel renders
          the required asterisk itself, already aria-hidden, so the requirement
          reaches assistive technology through aria-required on the control and
          not through a decorative star. */}
      <FormLabel id={labelId(id)} htmlFor={labelFuer}>
        {t(labelKey)}
      </FormLabel>
      {children}
      {/* error={false} against the FormControl's own state: a hint explains the
          field and stays muted whether or not the answer is wrong. Only the
          message below is red. */}
      {hinweisKey && (
        <FormHelperText id={hinweisId(id, true)} error={false}>
          {t(hinweisKey)}
        </FormHelperText>
      )}
      {/* Under the hint rather than in place of it, so the reason a field is
          needed and the reason it is wrong are both readable. */}
      {fehlerKey && (
        <FormHelperText className="field__error" id={fehlerId(id, true)}>
          {t(fehlerKey)}
        </FormHelperText>
      )}
    </FormControl>
  )
}

export default FeldRahmen
