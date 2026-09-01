import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { hinweisId, type FeldRahmenProps } from './rahmen'

/* What every field on the protocol has in common: a grid column, a label above
   the control, and an optional hint below it.

   Held in one place because the form has roughly 338 fields. A label
   association or a required marker got wrong here is got wrong once, not three
   hundred times, and accessibility is an acceptance criterion on every UI
   feature rather than a later pass. */
function FeldRahmen({
  id,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
  children,
}: FeldRahmenProps & { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <FormControl className={`field col-${spalten}`} required={pflicht} fullWidth>
      {/* FormLabel, not InputLabel: the mockups put a small bold label above the
          field rather than floating it into the border notch. FormLabel renders
          the required asterisk itself, already aria-hidden, so the requirement
          reaches assistive technology through aria-required on the control and
          not through a decorative star. */}
      <FormLabel htmlFor={id}>{t(labelKey)}</FormLabel>
      {children}
      {hinweisKey && (
        <FormHelperText id={hinweisId(id, hinweisKey)}>
          {t(hinweisKey)}
        </FormHelperText>
      )}
    </FormControl>
  )
}

export default FeldRahmen
