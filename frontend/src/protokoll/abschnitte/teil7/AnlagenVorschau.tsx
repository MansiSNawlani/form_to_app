import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { anlagenStore } from '../../anlagen/store'
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
 * The bytes are fetched here rather than handed down: store.ts keeps metadata
 * and files apart, and this is the one place that actually needs a file.
 */
function AnlagenVorschau({
  anlage,
  beschreibung,
  children,
  klasse,
}: AnlagenVorschauProps) {
  const { t } = useTranslation()
  const [quelle, setQuelle] = useState<string | null>(null)

  useEffect(() => {
    let aktuell = true
    let url: string | null = null

    void anlagenStore.readDatei(anlage.id).then((datei) => {
      if (datei === null) return
      if (!aktuell) return
      url = URL.createObjectURL(datei)
      setQuelle(url)
    })

    /* Not optional tidiness. An object URL holds its whole file in memory until
       it is revoked, and this tab stays open all day: twenty unrevoked previews
       is up to 200 MB pinned by something nothing on screen would show. */
    return () => {
      aktuell = false
      if (url !== null) URL.revokeObjectURL(url)
    }
  }, [anlage.id])

  // Rounded here, rendered by i18next, so this agrees with the size named in
  // the too-large message rather than formatting megabytes a second way.
  const mb = Math.round((anlage.groesse / 1024 / 1024) * 10) / 10

  return (
    <figure className={klasse === undefined ? 'anlage' : `anlage ${klasse}`}>
      <div className="anlage__bild">
        {quelle !== null && <img src={quelle} alt={beschreibung} />}
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
