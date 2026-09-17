import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import Uebergangsfehler from './Uebergangsfehler'
import { useInPruefungNehmen } from './useUebergang'

/* In Pruefung nehmen, above the decision itself.
 *
 * Its own component rather than a block inside the panel, because it is a whole
 * move with its own button, its own pending state and its own way of failing.
 * Optional in the workflow too: a decision can be made straight from SUBMITTED,
 * and backend/app/protokolle/uebergang/regeln.py says why picking a protocol up
 * is a courtesy to colleagues rather than a claim on it.
 */
function Aufnahmeblock({ entwurfId }: { entwurfId: string }) {
  const { t } = useTranslation()
  const aufnehmen = useInPruefungNehmen(entwurfId)

  return (
    <div className="entscheidung__aufnehmen">
      <Typography variant="body2" className="hinweis__text">
        {t('protokoll.entscheidung.aufnehmenHinweis')}
      </Typography>
      <Button
        variant="outlined"
        /* Disabled while the call is in flight. A second press would be refused
           as a transition that is no longer possible, and a refusal for
           something that in fact worked reads as a fault. */
        disabled={aufnehmen.isPending}
        onClick={() => {
          aufnehmen.mutate()
        }}
      >
        {aufnehmen.isPending
          ? t('protokoll.entscheidung.aufnehmenLaeuft')
          : t('protokoll.entscheidung.aufnehmen')}
      </Button>

      {/* Said out loud rather than swallowed. Two reviewers opening the same
          protocol is the ordinary case here, and the second one pressing this
          gets a refusal that would otherwise leave the button simply springing
          back with nothing on screen. */}
      {aufnehmen.isError && <Uebergangsfehler entwurfId={entwurfId} fehler={aufnehmen.error} />}
    </div>
  )
}

export default Aufnahmeblock
