import { useTranslation } from 'react-i18next'
import FeldAuswahl from '../felder/FeldAuswahl'
import FeldSuche from '../felder/FeldSuche'
import FeldText from '../felder/FeldText'

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
        {/* 722 monitoring numbers, so a search rather than a dropdown. Whether
            it is actually required depends on the Anlass, which is feature 4c;
            the mockup marks it required, so it is marked here too. */}
        <FeldSuche
          name="probestrecke.monitoringnummer"
          liste="probestrecke.monitoringnummer"
          labelKey="protokoll.abschnitt1.anlass.feld.monitoringnummer"
          hinweisKey="protokoll.abschnitt1.anlass.feld.monitoringnummerHinweis"
          spalten={4}
          pflicht
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
        {/* The PDF files the time under messdaten, which is part 2, while the
            mockup and the Submission model both put it in part 1. The path is
            the PDF's, the placement is ours. */}
        <FeldText
          name="messdaten.uhrzeit"
          typ="time"
          labelKey="protokoll.abschnitt1.anlass.feld.uhrzeit"
          spalten={3}
          pflicht
        />
        {/* The z. group is not in the data model and looks like FiaKa
            bookkeeping. Included by decision on 2026-09-01, pending FFS
            confirming that surveyors are the ones who fill it in. */}
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

export default Abschnitt1
