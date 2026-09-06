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
 * The bytes are fetched here rather than handed down, because the list the
 * blocks hold is metadata only. Twenty photographs is up to 200 MB, and a list
 * that carried the files would load all of it to draw a heading.
 */
function AnlagenVorschau({
  anlage,
  beschreibung,
  children,
  klasse,
}: AnlagenVorschauProps) {
  const { t, i18n } = useTranslation()
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

  const groesse = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  }).format(anlage.groesse / 1024 / 1024)

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
          {t('protokoll.abschnitt7.groesse', { mb: groesse })}
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
