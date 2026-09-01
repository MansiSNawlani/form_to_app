import { useTranslation } from 'react-i18next'
import FeldAuswahl from '../../felder/FeldAuswahl'
import FeldSuche from '../../felder/FeldSuche'
import FeldText from '../../felder/FeldText'

/* Why the Befischung happened, who is responsible for the record, and when.

   Required markers follow the mockup. Nothing is enforced yet: the rule that
   makes the Monitoringstrecken-Nr. mandatory for WRRL and FFH is feature 4c. */
function AnlassBlock() {
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
        {/* 722 monitoring numbers, so a search rather than a dropdown. Not
            marked required, unlike the mockup: it is required only for WRRL and
            FFH, so an unconditional aria-required would contradict its own
            hint. Feature 4c makes the marker follow the Anlass. */}
        <FeldSuche
          name="probestrecke.monitoringnummer"
          liste="probestrecke.monitoringnummer"
          labelKey="protokoll.abschnitt1.anlass.feld.monitoringnummer"
          hinweisKey="protokoll.abschnitt1.anlass.feld.monitoringnummerHinweis"
          spalten={4}
        />
        <FeldAuswahl
          name="z.rp"
          liste="z.rp"
          labelKey="protokoll.abschnitt1.anlass.feld.rp"
          spalten={3}
          pflicht
        />

        <FeldText
          name="datum"
          typ="date"
          labelKey="protokoll.abschnitt1.anlass.feld.datum"
          spalten={3}
          pflicht
        />
        <FeldText
          name="messdaten.uhrzeit"
          typ="time"
          labelKey="protokoll.abschnitt1.anlass.feld.uhrzeit"
          spalten={3}
          pflicht
        />
        <FeldAuswahl
          name="z.quelle"
          liste="z.quelle"
          labelKey="protokoll.abschnitt1.anlass.feld.quelle"
          hinweisKey="protokoll.abschnitt1.anlass.feld.quelleHinweis"
          spalten={4}
        />
        <FeldText
          name="z.ps_nummer"
          labelKey="protokoll.abschnitt1.anlass.feld.psNummer"
          spalten={2}
        />
      </div>
    </fieldset>
  )
}

export default AnlassBlock
