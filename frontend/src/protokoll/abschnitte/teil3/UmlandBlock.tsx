import { useTranslation } from 'react-i18next'
import ProzentBlock from './ProzentBlock'
import { UMLAND } from './bloecke'

/* What surrounds the stretch, as eight shares of the land along the bank.

   The one section block that is nothing but a single run of shares, so the
   fieldset holding it carries the run's own legend and there is no nesting. */
function UmlandBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.umland.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.umland.hinweis')}
      </p>

      <ProzentBlock block={UMLAND} />
    </fieldset>
  )
}

export default UmlandBlock
