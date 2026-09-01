import Typography from '@mui/material/Typography'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { protokollTitel } from './entwurf/titel'
import type { Antworten } from './entwurf/typen'

/* The page heading, which is the draft's own name once it has one.

   Its own component, and useWatch on exactly two fields rather than form.watch,
   so typing a Gewaessername re-renders this heading and nothing else. Watching
   from the page would re-render every field in the section on every keystroke,
   which at 338 fields is the thing React Hook Form is here to prevent. */
function ProtokollTitel() {
  const { t } = useTranslation()
  const { control } = useFormContext<Antworten>()

  const gewaessername = useWatch({
    control,
    name: 'probestrecke.gewaesser.gewaessername',
  })
  const ortsangabe = useWatch({ control, name: 'probestrecke.ortsangabe' })

  const titel = protokollTitel({
    probestrecke: { gewaesser: { gewaessername }, ortsangabe },
  })

  return (
    <Typography variant="h1">
      {titel ?? t('protokoll.kopf.titelPlatzhalter')}
    </Typography>
  )
}

export default ProtokollTitel
