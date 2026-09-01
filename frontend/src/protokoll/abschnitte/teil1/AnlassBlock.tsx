import { useEffect, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldAuswahl from '../../felder/FeldAuswahl'
import FeldDatum from '../../felder/FeldDatum'
import FeldSuche from '../../felder/FeldSuche'
import FeldText from '../../felder/FeldText'
import type { Antworten } from '../../entwurf/typen'
import { istMonitoringAnlass } from '../../regeln/monitoring'

/* Why the Befischung happened, who is responsible for the record, and when. */
function AnlassBlock() {
  const { t } = useTranslation()
  const { trigger } = useFormContext<Antworten>()
  const [anlass, monitoringnummer] = useWatch<
    Antworten,
    ['anlass', 'probestrecke.monitoringnummer']
  >({ name: ['anlass', 'probestrecke.monitoringnummer'] })

  /* The Monitoringstrecken-Nr. is a rule about two answers, and React Hook Form
     only rechecks the field being edited, so choosing an Anlass has to ask for
     the other field to be looked at again.

     It deliberately raises a message on a field nobody has been in, because the
     user has just made that field required and needs telling. Not on the first
     render though: opening a half-finished draft should not greet somebody with
     an error before they have touched anything. */
  const ersteRunde = useRef(true)
  useEffect(() => {
    if (ersteRunde.current) {
      ersteRunde.current = false
      return
    }
    void trigger('probestrecke.monitoringnummer')
  }, [anlass, monitoringnummer, trigger])

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
        {/* 722 monitoring numbers, so a search rather than a dropdown. The
            marker follows the Anlass rather than standing there always, because
            only a monitoring programme assigns a number at all, which is what
            the hint underneath says. */}
        <FeldSuche
          name="probestrecke.monitoringnummer"
          liste="probestrecke.monitoringnummer"
          labelKey="protokoll.abschnitt1.anlass.feld.monitoringnummer"
          hinweisKey="protokoll.abschnitt1.anlass.feld.monitoringnummerHinweis"
          spalten={4}
          pflicht={istMonitoringAnlass(anlass)}
        />
        <FeldAuswahl
          name="z.rp"
          liste="z.rp"
          labelKey="protokoll.abschnitt1.anlass.feld.rp"
          spalten={3}
          pflicht
        />

        <FeldDatum
          name="datum"
          art="datum"
          labelKey="protokoll.abschnitt1.anlass.feld.datum"
          spalten={3}
          pflicht
        />
        <FeldDatum
          name="messdaten.uhrzeit"
          art="uhrzeit"
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
