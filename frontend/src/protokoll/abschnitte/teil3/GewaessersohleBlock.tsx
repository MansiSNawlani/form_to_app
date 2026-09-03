import { useTranslation } from 'react-i18next'
import ProzentBlock from './ProzentBlock'
import { SOHLVERBAUUNG, SUBSTRAT } from './bloecke'
import FeldHaken from '../../felder/FeldHaken'

/* The bed: what it is made of, how it has been built up, and what stands out
   about it.

   Two runs of shares and then four observations that are ticked rather than
   shared out. The Besonderheiten are not a run and never add up to anything,
   which is why they sit outside both ProzentBlocks. */
function GewaessersohleBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.gewaessersohle.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.gewaessersohle.hinweis')}
      </p>

      <ProzentBlock
        legendKey="protokoll.abschnitt3.gewaessersohle.substrat.legend"
        felder={SUBSTRAT}
      />

      <ProzentBlock
        legendKey="protokoll.abschnitt3.gewaessersohle.sohlverbauung.legend"
        felder={SOHLVERBAUUNG}
      />

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.gewaessersohle.besonderheiten.legend')}</legend>
        <div className="haken-reihe">
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
