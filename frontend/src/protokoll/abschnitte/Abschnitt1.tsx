import { useTranslation } from 'react-i18next'
import FeldAuswahl from '../felder/FeldAuswahl'

/* Section 1: Anlass, Bearbeiter and Probestrecke.

   Steps 2 to 5 of feature 4b add the remaining fields of the Anlass block, then
   the Bearbeiter block and the Probestrecke block. Only the Anlass dropdown is
   here, as the one field that proves a value chosen in the form reaches storage
   and comes back.

   Every field is addressed by its legacy PDF path, which is what keeps the
   stored document a direct match for what FiaKa already receives. */
function Abschnitt1() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt1.anlass.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt1.anlass.hinweis')}
      </p>

      <div className="grid">
        <FeldAuswahl
          name="anlass"
          liste="anlass"
          labelKey="protokoll.abschnitt1.anlass.feld.anlass"
          spalten={5}
          pflicht
        />
      </div>
    </fieldset>
  )
}

export default Abschnitt1
