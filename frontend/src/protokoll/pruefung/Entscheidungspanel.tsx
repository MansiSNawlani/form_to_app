import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useInPruefungNehmen } from './useUebergang'

interface EntscheidungspanelProps {
  entwurfId: string
  /* Whether this protocol can still be picked up. False once it is IN_REVIEW,
     which is the only state In Pruefung nehmen leads to. */
  kannAufnehmen: boolean
}

/* What a reviewer can do about the protocol beside it.
 *
 * Built against the Entscheidung panel in prototypes/pruefung-protokoll.html.
 * Drawn only where entscheidungen.ts says so, which is not a permission: the
 * server refuses every one of these again, and this decides what is worth
 * putting on screen.
 */
function Entscheidungspanel({ entwurfId, kannAufnehmen }: EntscheidungspanelProps) {
  const { t } = useTranslation()
  const aufnehmen = useInPruefungNehmen(entwurfId)

  return (
    <section className="card">
      <h2 className="panel__head">{t('protokoll.entscheidung.titel')}</h2>
      <div className="panel__body">
        {kannAufnehmen && (
          <div className="entscheidung__aufnehmen">
            <Typography variant="body2" className="hinweis__text">
              {t('protokoll.entscheidung.aufnehmenHinweis')}
            </Typography>
            <Button
              variant="outlined"
              /* Disabled while the call is in flight. A second press would be
                 refused as a transition that is no longer possible, and a
                 refusal for something that in fact worked reads as a fault. */
              disabled={aufnehmen.isPending}
              onClick={() => {
                aufnehmen.mutate()
              }}
            >
              {aufnehmen.isPending
                ? t('protokoll.entscheidung.aufnehmenLaeuft')
                : t('protokoll.entscheidung.aufnehmen')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export default Entscheidungspanel
