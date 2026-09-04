import { useTranslation } from 'react-i18next'
import { STRUKTUREN } from './bloecke'
import { STRUKTURSTUFEN } from './stufen'
import FeldRadio from '../../felder/FeldRadio'
import FeldText from '../../felder/FeldText'

/* What grows and lies in the water along the stretch, rated rather than
   measured.

   Eight ratings on one scale, so they are laid out two to a row: four buttons
   plus a label needs the width, and a rating whose scale is cut off mid-row is
   worse than one further scroll.

   The last rating is printed with no label at all, just a box at the end of the
   row and a writing line after it. It is labelled here, because by the end of
   section 4 there are three "Sonstiges" boxes on one page and a screen reader
   user has to be able to tell them apart. Same problem 5a solved for the two
   Schätzwert boxes and 6a for the two bank ones. */
function StrukturenBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt4.strukturen.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt4.strukturen.hinweis')}
      </p>

      <div className="grid">
        {STRUKTUREN.map(({ pfad, labelKey }) => (
          <FeldRadio
            key={pfad}
            name={pfad}
            liste={STRUKTURSTUFEN}
            labelKey={labelKey}
            spalten={6}
          />
        ))}
        <FeldText
          name="strukturen.sonstige_strukturen_text"
          labelKey="protokoll.abschnitt4.strukturen.feld.sonstigeStrukturenText"
          spalten={6}
        />
      </div>
    </fieldset>
  )
}

export default StrukturenBlock
