import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export type Grenze = 'unten' | 'oben'

interface GrenzwahlProps {
  gewaehlt: Grenze
  waehlen: (grenze: Grenze) => void
}

/* Which boundary a click on the map sets. One Tab stop for the pair, and the
   arrow keys move between them, which is MUI's toggle group behaviour. */
function Grenzwahl({ gewaehlt, waehlen }: GrenzwahlProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    <div className="probestreckenkarte__werkzeuge">
      <span id={id}>{t('protokoll.karte.setzen')}</span>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={gewaehlt}
        onChange={(_, neu: Grenze | null) => neu && waehlen(neu)}
        aria-labelledby={id}
      >
        <ToggleButton value="unten">{t('protokoll.karte.untereGrenze')}</ToggleButton>
        <ToggleButton value="oben">{t('protokoll.karte.obereGrenze')}</ToggleButton>
      </ToggleButtonGroup>
    </div>
  )
}

export default Grenzwahl
