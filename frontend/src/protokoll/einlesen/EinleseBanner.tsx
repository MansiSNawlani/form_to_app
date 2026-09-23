import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { GemerkterBericht } from './bericht'

interface EinleseBannerProps {
  bericht: GemerkterBericht | null
  onGelesen: () => void
}

/* This protocol came out of a PDF, and here is what that means.
 *
 * An explanation rather than a problem, which is why it is the one thing here
 * that can be dismissed. Dismissing it records that it was read and nothing
 * else: the unusable answers and the missing pictures describe work still
 * outstanding, and a list one click destroys is the failure AbsendeProbleme was
 * reshaped on 2026-09-12 to stop.
 *
 * It says the protocol is a draft, because that is what people get wrong:
 * importing is not filing, and an imported protocol is held to exactly the rules
 * anything typed in here is, the legacy form having let incorrect data through
 * for years.
 *
 * The version named is the file's, never the protocol's, which is stamped with
 * the version this deployment serves because every import is a new survey. An
 * old template is not an old survey: all three real files supplied on
 * 2026-09-22 record 2026 surveys on templates from 2023 and 2024.
 */
function EinleseBanner({ bericht, onGelesen }: EinleseBannerProps) {
  const { t } = useTranslation()

  if (bericht === null || bericht.bannerGelesen) return null

  return (
    <Alert severity="info" onClose={onGelesen} className="einlesen__banner">
      <AlertTitle>{t('protokoll.einlesen.banner.titel')}</AlertTitle>
      <Typography variant="body2">
        {t('protokoll.einlesen.banner.text', { quellversion: bericht.quellversion })}
      </Typography>
    </Alert>
  )
}

export default EinleseBanner
