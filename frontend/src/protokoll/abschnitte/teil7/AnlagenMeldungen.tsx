import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import type { Meldung } from '../../anlagen/useAnlagen'

interface AnlagenMeldungenProps {
  meldungen: Meldung[]
}

/* What went wrong with the files just picked, one message per file.
 *
 * One row each rather than a summary, because a pick can hold twenty and the
 * whole point of these messages is that each names its own file and its own way
 * out. "3 Dateien konnten nicht hinzugefügt werden" would throw away exactly
 * the part worth reading.
 *
 * MUI's Alert carries role="alert" itself, so a screen reader hears each one
 * without a live region of our own.
 */
function AnlagenMeldungen({ meldungen }: AnlagenMeldungenProps) {
  const { t } = useTranslation()

  if (meldungen.length === 0) return null

  return (
    <Stack spacing={1} className="anlagen__meldungen">
      {meldungen.map((meldung) => (
        <Alert key={meldung.id} severity="warning">
          {/* A key, ours or the server's refusal under fehler.server, or the
              server's own German for a code the locale file does not know yet.
              Since feature 3d the server is what refuses a file, and its
              refusals name the file, say why in ordinary words, and end with
              something the reader can do. */}
          {meldung.text ?? (meldung.schluessel ? t(meldung.schluessel, meldung.werte) : '')}
        </Alert>
      ))}
    </Stack>
  )
}

export default AnlagenMeldungen
