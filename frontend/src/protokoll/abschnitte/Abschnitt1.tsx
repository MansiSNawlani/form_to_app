import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Antworten } from '../entwurf/typen'
import { optionen } from '../optionen'

/* Section 1: Anlass, Bearbeiter and Probestrecke.

   Feature 4b adds the Bearbeiter and Probestrecke blocks and the rest of the
   Anlass block (Monitoringstrecken-Nr., Regierungspräsidium, Datum, Uhrzeit).
   Only the Anlass dropdown is here, as the one field that proves a value typed
   into the form reaches storage and comes back.

   The field is registered under its legacy PDF path, "anlass". Every field from
   4b on does the same, which is what keeps the stored document a direct match
   for what FiaKa already receives. */
function Abschnitt1() {
  const { t } = useTranslation()
  const { register } = useFormContext<Antworten>()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt1.anlass.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt1.anlass.hinweis')}
      </p>

      <div className="grid">
        <div className="field col-5">
          <label htmlFor="anlass">
            {t('protokoll.abschnitt1.anlass.label')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          {/* The asterisk beside the label is decorative, so the requirement
              itself is announced from here. Enforcing it is feature 4c's job;
              saying so is this one's. */}
          <select id="anlass" aria-required="true" {...register('anlass')}>
            {/* Empty rather than preselected: a draft that has not been answered
                must not look as though it has been. */}
            <option value="">{t('protokoll.felder.bitteWaehlen')}</option>
            {optionen('anlass').map((option) => (
              <option key={option.wert} value={option.wert}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  )
}

export default Abschnitt1
