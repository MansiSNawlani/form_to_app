import { useTranslation } from 'react-i18next'
import FeldRadio from '../../felder/FeldRadio'
import FeldText from '../../felder/FeldText'

/* What was measured at the water on the day: three readings and three
   observations.

   These describe one visit, unlike part 1's Probestrecke answers, which describe
   a place. The same stretch fished again next year gets a new set of these
   against the same Probestrecke (ADR 0001).

   messdaten.uhrzeit belongs to this group by its legacy path but is rendered in
   section 1, where the mockup and the Submission model both put it. */
function MessdatenBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt2.messdaten.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt2.messdaten.hinweis')}
      </p>

      <div className="grid">
        <FeldText
          name="messdaten.temperatur"
          typ="number"
          einheit={t('protokoll.felder.einheit.grad')}
          labelKey="protokoll.abschnitt2.messdaten.feld.temperatur"
          spalten={4}
          pflicht
        />
        <FeldText
          name="messdaten.leitfaehigkeit"
          typ="number"
          einheit={t('protokoll.felder.einheit.mikrosiemens')}
          labelKey="protokoll.abschnitt2.messdaten.feld.leitfaehigkeit"
          spalten={4}
          pflicht
        />
        {/* The hint is the legacy form's own, printed beside this field: with a
            clear view of the bed the whole way, the maximum depth is what goes
            in rather than a visibility reading. */}
        <FeldText
          name="messdaten.sichttiefe"
          typ="number"
          einheit={t('protokoll.felder.einheit.zentimeter')}
          labelKey="protokoll.abschnitt2.messdaten.feld.sichttiefe"
          hinweisKey="protokoll.abschnitt2.messdaten.feld.sichttiefeHinweis"
          spalten={4}
        />
      </div>

      {/* One group per row rather than three across. "während der Untersuchung"
          is as wide as a third of the card on its own, and the legacy form
          prints them stacked for the same reason. */}
      <div className="grid">
        <FeldRadio
          name="messdaten.regenfaelle"
          liste="messdaten.regenfaelle"
          labelKey="protokoll.abschnitt2.messdaten.feld.regenfaelle"
          spalten={12}
          pflicht
        />
        <FeldRadio
          name="messdaten.truebung"
          liste="messdaten.truebung"
          labelKey="protokoll.abschnitt2.messdaten.feld.truebung"
          spalten={12}
          pflicht
        />
        <FeldRadio
          name="messdaten.schaumbildung"
          liste="messdaten.schaumbildung"
          labelKey="protokoll.abschnitt2.messdaten.feld.schaumbildung"
          spalten={12}
          pflicht
        />
      </div>
    </fieldset>
  )
}

export default MessdatenBlock
