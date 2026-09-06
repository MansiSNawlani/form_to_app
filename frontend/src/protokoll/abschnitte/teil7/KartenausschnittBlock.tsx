import { useTranslation } from 'react-i18next'

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
function KartenausschnittBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt7.kartenausschnitt.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt7.kartenausschnitt.hinweis')}
      </p>
    </fieldset>
  )
}

export default KartenausschnittBlock
