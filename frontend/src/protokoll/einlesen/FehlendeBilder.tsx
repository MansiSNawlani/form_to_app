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
 * Here, at the top of section 7, rather than only on the arrival banner. An
 * attachment is part of the protocol rather than a decoration on it, so a count
 * printed once on a banner somebody dismisses is a count nobody sees again, and
 * the protocol then reaches a reviewer with its photographs silently missing.
 * This is the one screen where somebody is actually looking at their
 * attachments, which makes it the one place the message can still be acted on.
 *
 * It does not go away, because the thing it describes does not: until feature
 * 23d reads the pictures out of the file into real Anlagen, attaching them again
 * is a job only the person can do. It says how many to look for, which is what
 * turns "something is missing" into a task with an end.
 *
 * Deliberately its own block above the two attachment blocks rather than a line
 * inside one of them: it is about the import, not about the files already
 * uploaded, and the legacy form holds both a map excerpt and photographs as
 * buttons, so the count covers both and belongs to neither.
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
