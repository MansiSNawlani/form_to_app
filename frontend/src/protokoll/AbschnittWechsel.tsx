import Button from '@mui/material/Button'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import SpeicherAnzeige from './SpeicherAnzeige'
import { ABSCHNITTE, abschnittPfad } from './abschnitte'
import type { SaveState } from './entwurf/useAutoSave'

interface AbschnittWechselProps {
  entwurfId: string
  aktuelleNr: number
  saveState: SaveState
}

/* The action row at the foot of the card: back, forward, and the save state
   again. The step bar above does the same job, so this is a convenience for
   someone who has just reached the bottom of a long section, not the only way
   through. */
function AbschnittWechsel({
  entwurfId,
  aktuelleNr,
  saveState,
}: AbschnittWechselProps) {
  const { t } = useTranslation()

  const vorheriger = ABSCHNITTE.find((a) => a.nr === aktuelleNr - 1)
  const naechster = ABSCHNITTE.find((a) => a.nr === aktuelleNr + 1)

  return (
    <div className="form-actions">
      {/* On section 1 this stays a plain disabled button. A link with nowhere to
          go would still be focusable and still announce itself as a link. */}
      {vorheriger ? (
        <Button
          component={Link}
          to={abschnittPfad(entwurfId, vorheriger.nr)}
          variant="outlined"
        >
          {t('protokoll.navigation.zurueck')}
        </Button>
      ) : (
        <Button disabled variant="outlined">
          {t('protokoll.navigation.zurueck')}
        </Button>
      )}
      {naechster && (
        <Button
          component={Link}
          to={abschnittPfad(entwurfId, naechster.nr)}
          variant="contained"
        >
          {t('protokoll.navigation.weiter', { abschnitt: t(naechster.titelKey) })}
        </Button>
      )}
      <div className="form-actions__spacer" />
      <SpeicherAnzeige {...saveState} live={false} />
    </div>
  )
}

export default AbschnittWechsel
