import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

interface FehlendeBilderProps {
  /** How many pictures the imported file carries. Nothing is drawn for none. */
  anzahl: number
}

/* The pictures the imported PDF carries, which did not come with its answers.
 *
 * Here rather than only on the arrival banner, because an attachment is part of
 * the protocol: a count printed once on something dismissable is a count nobody
 * sees again, and the protocol reaches a reviewer with its photographs silently
 * missing. It stays until feature 23d reads them out into real Anlagen, since
 * until then attaching them again is a job only the person can do.
 */
function FehlendeBilder({ anzahl }: FehlendeBilderProps) {
  const { t } = useTranslation()

  if (anzahl <= 0) return null

  return (
    <Alert severity="info" className="einlesen__bilder">
      <AlertTitle>{t('protokoll.einlesen.bilder.titel', { count: anzahl })}</AlertTitle>
      <Typography variant="body2">{t('protokoll.einlesen.bilder.text', { count: anzahl })}</Typography>
    </Alert>
  )
}

export default FehlendeBilder
