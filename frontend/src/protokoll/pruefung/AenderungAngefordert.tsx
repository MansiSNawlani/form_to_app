import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { zeitpunktAnzeige } from '../liste/anzeige'
import { verlaufsAbfrage } from './abfragen'
import { letzteAenderungsbitte } from './aenderungsbitte'

interface AenderungAngefordertProps {
  entwurfId: string
}

/* What the reviewer asked for, above the form while it is being put right.
 *
 * Above the form rather than on a page of its own, because the surveyor needs to
 * read it *while* correcting: a message on a screen they have to leave to reach
 * the fields is a message they will have to remember. Same reasoning that moved
 * the problem list above the section in feature 11c.
 *
 * It renders nothing at all rather than a placeholder when the history has not
 * arrived, or holds no change request. The form underneath is the point of the
 * page, and a box saying "loading" above it would push the first field down for
 * no gain.
 */
function AenderungAngefordert({ entwurfId }: AenderungAngefordertProps) {
  const { t } = useTranslation()
  const { data: verlauf } = useQuery(verlaufsAbfrage(entwurfId))

  const bitte = verlauf === undefined ? undefined : letzteAenderungsbitte(verlauf)
  if (bitte === undefined) return null

  const wann = zeitpunktAnzeige(bitte.created_at)

  return (
    <Alert severity="warning" className="protokoll-fehler">
      <AlertTitle>{t('protokoll.aenderung.titel')}</AlertTitle>
      {/* The whole sentence or none of it. A timestamp that will not parse used
          to leave "angefordert von X am  Uhr", and a gap where a date belongs
          reads as a fault in the application rather than as a missing detail. */}
      <Typography variant="body2" className="hinweis__text">
        {wann === null
          ? t('protokoll.aenderung.vonOhneZeit', { person: bitte.akteur_name })
          : t('protokoll.aenderung.von', { person: bitte.akteur_name, zeitpunkt: wann })}
      </Typography>
      {/* The reviewer's own words, quoted rather than paraphrased. Nothing here
          reformats them: this is the one piece of free text in the application
          written by one person for another. */}
      <Typography variant="body1" component="blockquote" className="aenderung__begruendung">
        {bitte.kommentar}
      </Typography>
      <Typography variant="body2" className="hinweis__text">
        {t('protokoll.aenderung.hinweis')}
      </Typography>
    </Alert>
  )
}

export default AenderungAngefordert
