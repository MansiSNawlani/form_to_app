import { useTranslation } from 'react-i18next'
import { UMLAND } from './bloecke'
import FeldProzent from '../../felder/FeldProzent'

/* What surrounds the stretch, as eight shares of the land along the bank.

   Four to a row at desktop width, which is how the printed form groups them and
   what keeps two lines of four readable rather than one column of eight.

   No total anywhere in here. The eight have to add up to 100 and feature 6b is
   what says so. */
function UmlandBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.umland.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.umland.hinweis')}
      </p>

      <div className="grid">
        {UMLAND.map(({ pfad, labelKey }) => (
          <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
      </div>
    </fieldset>
  )
}

export default UmlandBlock
