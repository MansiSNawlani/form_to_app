import Button from '@mui/material/Button'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AnlagenMeldungen from './AnlagenMeldungen'
import AnlagenPicker from './AnlagenPicker'
import AnlagenVorschau from './AnlagenVorschau'
import AnlagenZustand from './AnlagenZustand'
import EntfernenDialog from './EntfernenDialog'
import { useAnlagen } from '../../anlagen/useAnlagen'

interface KartenausschnittBlockProps {
  entwurfId: string
}

/* The map excerpt showing where the stretch is.
 *
 * One slot rather than a list, because there is one stretch and one excerpt of
 * it. That limit is about the thing, unlike the photograph cap next door, which
 * is only a safety valve.
 *
 * With the map picker deferred to feature 18, this and the typed coordinates in
 * part 1 are the whole of what version 1 knows about where a survey happened.
 * docs/decisions.md pulled attachments forward for exactly that reason.
 */
function KartenausschnittBlock({ entwurfId }: KartenausschnittBlockProps) {
  const { t } = useTranslation()
  const { status, anlagen, meldungen, ersetzen, entfernen } = useAnlagen(
    entwurfId,
    'KARTENAUSSCHNITT',
  )

  const karte = anlagen[0]
  const [fragt, setFragt] = useState(false)

  /* Where focus goes once the preview disappears, so it does not fall to the
     top of the document and make a keyboard user tab the section again. */
  const picker = useRef<HTMLLabelElement>(null)

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt7.kartenausschnitt.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt7.kartenausschnitt.hinweis')}
      </p>

      <AnlagenZustand status={status} />

      {status === 'geladen' && karte === undefined && (
        <AnlagenPicker
          ref={picker}
          beschriftung={t('protokoll.abschnitt7.kartenausschnitt.waehlen')}
          onDateien={(dateien) => void ersetzen(dateien[0])}
        />
      )}

      {status === 'geladen' && karte !== undefined && (
        <AnlagenVorschau
          anlage={karte}
          klasse="anlage--einzeln"
          beschreibung={t('protokoll.abschnitt7.kartenausschnitt.alt', {
            dateiname: karte.dateiname,
          })}
        >
          {/* Replacing does not ask first: the button says what it does, and
              the picker that opens is a second chance to change your mind.
              Removing does ask, because nothing takes the file's place. */}
          <AnlagenPicker
            beschriftung={t('protokoll.abschnitt7.ersetzen')}
            onDateien={(dateien) => void ersetzen(dateien[0])}
          />
          <Button variant="text" onClick={() => setFragt(true)}>
            {t('protokoll.abschnitt7.entfernen')}
          </Button>
        </AnlagenVorschau>
      )}

      <AnlagenMeldungen meldungen={meldungen} />

      <EntfernenDialog
        dateiname={fragt && karte !== undefined ? karte.dateiname : null}
        onAbbrechen={() => setFragt(false)}
        onBestaetigen={() => {
          if (karte !== undefined) void entfernen(karte.id)
          setFragt(false)
          picker.current?.focus()
        }}
      />
    </fieldset>
  )
}

export default KartenausschnittBlock
