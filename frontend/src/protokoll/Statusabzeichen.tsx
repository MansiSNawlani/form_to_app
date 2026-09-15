import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { statusAnzeige, type Statusfarbe } from './liste/anzeige'
import type { Status } from './entwurf/typen'

/* Our token colour to MUI's palette slot. One line rather than a colour prop
   chosen per status at the call site, so the badge cannot drift from what
   anzeige.ts decided. */
const CHIP_FARBE: Record<Statusfarbe, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  neutral: 'default',
  info: 'info',
  warn: 'warning',
  danger: 'error',
  ok: 'success',
}

/* What state a protocol is in, as a badge.
 *
 * Lifted out of the list row in feature 11e, when the reviewer's screen became
 * the second place that has to say it. Two copies would have been two chances
 * for the same status to be shown in two colours, on two screens somebody moves
 * between.
 *
 * **The colour never carries the meaning on its own.** The badge always prints
 * the word as well, so it works without colour vision and in a printout.
 */
function Statusabzeichen({ status }: { status: Status }) {
  const { t } = useTranslation()
  const anzeige = statusAnzeige(status)

  return <Chip size="small" color={CHIP_FARBE[anzeige.farbe]} label={t(anzeige.schluessel)} />
}

export default Statusabzeichen
