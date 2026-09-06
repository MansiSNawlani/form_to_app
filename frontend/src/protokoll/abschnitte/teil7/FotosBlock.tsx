import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AnlagenMeldungen from './AnlagenMeldungen'
import AnlagenPicker from './AnlagenPicker'
import AnlagenVorschau from './AnlagenVorschau'
import AnlagenZustand from './AnlagenZustand'
import EntfernenDialog from './EntfernenDialog'
import { MAX_FOTOS } from '../../anlagen/regeln'
import { useAnlagen } from '../../anlagen/useAnlagen'

interface FotosBlockProps {
  entwurfId: string
}

/* Photographs of the stretch.
 *
 * The legacy form has four slots and we do not inherit that number; see FFS
 * question 11. Four is how many image buttons fitted on the printed page, not a
 * statement about how many pictures a survey may have, and a crew that took
 * eight useful ones should not have to choose four and email the rest.
 *
 * The picker takes several files at once, because twenty added singly is twenty
 * file dialogs. A pick that only partly fits stores what fits and reports the
 * rest by name; useAnlagen owns that order.
 */
function FotosBlock({ entwurfId }: FotosBlockProps) {
  const { t } = useTranslation()
  const { status, anlagen, meldungen, hinzufuegen, entfernen } = useAnlagen(
    entwurfId,
    'FOTO',
  )

  // Which photograph the question is about. null means no question is open.
  const [zuEntfernen, setZuEntfernen] = useState<string | null>(null)
  const gefragt = anlagen.find((anlage) => anlage.id === zuEntfernen)

  /* Where focus goes once a tile disappears. The button that had focus went
     with it, and the browser's fallback is the top of the document, which for a
     keyboard user means tabbing back through the whole section. */
  const picker = useRef<HTMLLabelElement>(null)

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt7.fotos.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt7.fotos.hinweis', { max: MAX_FOTOS })}
      </p>

      <AnlagenZustand status={status} />

      {status === 'geladen' && (
        <>
          <div className="anlagen__kopf">
            <AnlagenPicker
              ref={picker}
              beschriftung={t('protokoll.abschnitt7.fotos.waehlen')}
              mehrere
              onDateien={(dateien) => void hinzufuegen(dateien)}
            />
            <Typography variant="body2" color="text.secondary">
              {t('protokoll.abschnitt7.fotos.anzahl', {
                vorhanden: anlagen.length,
                max: MAX_FOTOS,
              })}
            </Typography>
          </div>

          {anlagen.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('protokoll.abschnitt7.fotos.leer')}
            </Typography>
          )}

          {anlagen.length > 0 && (
            <ul className="anlagen__liste">
              {anlagen.map((anlage, index) => (
                <li key={anlage.id}>
                  <AnlagenVorschau
                    anlage={anlage}
                    beschreibung={t('protokoll.abschnitt7.fotos.alt', {
                      nummer: index + 1,
                      dateiname: anlage.dateiname,
                    })}
                  >
                    <Button variant="text" onClick={() => setZuEntfernen(anlage.id)}>
                      {t('protokoll.abschnitt7.entfernen')}
                    </Button>
                  </AnlagenVorschau>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AnlagenMeldungen meldungen={meldungen} />

      <EntfernenDialog
        dateiname={gefragt?.dateiname ?? null}
        onAbbrechen={() => setZuEntfernen(null)}
        onBestaetigen={() => {
          if (zuEntfernen !== null) void entfernen(zuEntfernen)
          setZuEntfernen(null)
          picker.current?.focus()
        }}
      />
    </fieldset>
  )
}

export default FotosBlock
