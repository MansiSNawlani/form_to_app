import { useTranslation } from 'react-i18next'
import { MAX_FOTOS } from '../../anlagen/regeln'

/* Photographs of the stretch.
 *
 * The legacy form has four slots and we do not inherit that number; see FFS
 * question 11. Four is how many image buttons fitted on the printed page, not a
 * statement about how many pictures a survey may have, and a crew that took
 * eight useful ones should not have to choose four and email the rest.
 */
function FotosBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt7.fotos.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt7.fotos.hinweis', { max: MAX_FOTOS })}
      </p>
    </fieldset>
  )
}

export default FotosBlock
