import { useTranslation } from 'react-i18next'
import { SOHLVERBAUUNG, SUBSTRAT } from './bloecke'
import FeldHaken from '../../felder/FeldHaken'
import FeldProzent from '../../felder/FeldProzent'

/* The bed: what it is made of, how it has been built up, and what stands out
   about it.

   Two percentage runs and then four observations that are ticked rather than
   shared out. The Besonderheiten are not a run and never add up to anything,
   which is why they sit outside both nested fieldsets. */
function GewaessersohleBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.gewaessersohle.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.gewaessersohle.hinweis')}
      </p>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.gewaessersohle.substrat.legend')}</legend>
        <div className="grid">
          {SUBSTRAT.map(({ pfad, labelKey }) => (
            <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
          ))}
        </div>
      </fieldset>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.gewaessersohle.sohlverbauung.legend')}</legend>
        <div className="grid">
          {SOHLVERBAUUNG.map(({ pfad, labelKey }) => (
            <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
          ))}
        </div>
      </fieldset>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.gewaessersohle.besonderheiten.legend')}</legend>
        <div className="options">
          <FeldHaken
            name="gewaessersohle.kolmatierte_sohle"
            labelKey="protokoll.abschnitt3.gewaessersohle.feld.kolmatierteSohle"
          />
          <FeldHaken
            name="gewaessersohle.eisenocker"
            labelKey="protokoll.abschnitt3.gewaessersohle.feld.eisenocker"
          />
          <FeldHaken
            name="gewaessersohle.treibsand"
            labelKey="protokoll.abschnitt3.gewaessersohle.feld.treibsand"
          />
          <FeldHaken
            name="gewaessersohle.faulschlamm"
            labelKey="protokoll.abschnitt3.gewaessersohle.feld.faulschlamm"
          />
        </div>
      </fieldset>
    </fieldset>
  )
}

export default GewaessersohleBlock
