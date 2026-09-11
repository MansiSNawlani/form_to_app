import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { anlagenDateiUrl } from '../../anlagen/api'
import type { Anlage } from '../../anlagen/typen'

interface AnlagenVorschauProps {
  anlage: Anlage
  /** Alternative text. Says what the picture is, not just that it is one. */
  beschreibung: string
  /** The buttons that act on this attachment. */
  children?: ReactNode
  /** Extra class on the tile, for the single slot. */
  klasse?: string
}

/* One attachment on screen: the picture, its name, its size, and whatever can
 * be done to it.
 *
 * **The picture is an address, not bytes**, since feature 3d put attachments on
 * the server. The browser fetches it itself, with the session cookie riding
 * along because it is same-origin, so nothing here downloads a file, holds one,
 * or has to remember to let go of one.
 *
 * That retires the sharpest edge feature 10 had. It read each file out of
 * IndexedDB and made an object URL, which holds its whole file in memory until
 * it is revoked; at twenty photographs a single missed revoke pinned up to
 * 200 MB for as long as the tab stayed open, which on this form is all day.
 * There is now nothing to leak, which is better than remembering to tidy up.
 *
 * The server marks these immutable and cacheable, so a section reopened does not
 * fetch them all again.
 */
function AnlagenVorschau({ anlage, beschreibung, children, klasse }: AnlagenVorschauProps) {
  const { t } = useTranslation()

  // Rounded here, rendered by i18next, so this agrees with the size named in
  // the too-large message rather than formatting megabytes a second way.
  const mb = Math.round((anlage.groesse / 1024 / 1024) * 10) / 10

  return (
    <figure className={klasse === undefined ? 'anlage' : `anlage ${klasse}`}>
      <div className="anlage__bild">
        <img
          src={anlagenDateiUrl(anlage.submission_id, anlage.id)}
          alt={beschreibung}
          /* The picture is offscreen until the section is opened and there can
             be twenty of them, so the browser is told it may wait. */
          loading="lazy"
        />
      </div>
      <figcaption className="anlage__details">
        <Typography variant="body2" className="anlage__name">
          {anlage.dateiname}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('protokoll.abschnitt7.groesse', { mb })}
        </Typography>
        {children !== undefined && (
          <Stack direction="row" spacing={1} className="anlage__aktionen">
            {children}
          </Stack>
        )}
      </figcaption>
    </figure>
  )
}

export default AnlagenVorschau
