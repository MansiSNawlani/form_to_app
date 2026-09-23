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
 * An explanation rather than a problem, which is why it is the one thing on this
 * screen that can be dismissed. Dismissing it records that it was read and
 * nothing else: the unusable answers stay in the section panels and the missing
 * pictures stay on section 7, because those describe work still outstanding and
 * a list that one click destroys is the failure AbsendeProbleme was reshaped on
 * 2026-09-12 to stop.
 *
 * It says three things, and the third is the one people get wrong. The protocol
 * is a draft: nobody has submitted it, importing is not filing, and it is held
 * to exactly the rules anything typed in here is held to. An imported protocol
 * is never trusted, because the legacy Acrobat form has validation bugs of its
 * own that let incorrect data through for years.
 *
 * The version named is the **file's**, never the protocol's. The protocol is
 * stamped with the version this deployment serves, because every import is a new
 * survey. An old template is not an old survey either: people fill in whatever
 * copy of the PDF they downloaded years ago, and all three of the real files
 * supplied on 2026-09-22 record 2026 surveys on templates from 2023 and 2024.
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
