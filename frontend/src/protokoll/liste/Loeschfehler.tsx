import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { protokollName } from './anzeige'
import { useFehlertext } from '../../api/useFehlertext'
import type { Uebersicht } from '../entwurf/typen'

interface LoeschfehlerProps {
  zeile: Uebersicht
  fehler: unknown
}

/* A draft could not be deleted.
 *
 * Names the protocol, because a message about "das Protokoll" over a list of
 * several says nothing about which one, and says it is still there and
 * unchanged, because that is the question somebody actually has after a delete
 * that did not work.
 *
 * No retry button. The row is still in the table with its own delete beside it,
 * which is a better place to try again from than a message that would have to
 * remember what it was about.
 */
function Loeschfehler({ zeile, fehler }: LoeschfehlerProps) {
  const { t } = useTranslation()
  const fehlertext = useFehlertext(fehler)

  const name = protokollName(zeile) ?? t('protokolle.list.ohneGewaesser')

  return (
    <Alert severity="error">
      <AlertTitle>{t('protokolle.list.loeschfehler.titel')}</AlertTitle>
      <Typography variant="body2">
        {t('protokolle.list.loeschfehler.text', { name })} {fehlertext}
      </Typography>
    </Alert>
  )
}

export default Loeschfehler
