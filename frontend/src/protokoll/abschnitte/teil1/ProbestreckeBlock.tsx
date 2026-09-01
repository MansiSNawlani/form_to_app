import { useTranslation } from 'react-i18next'
import FeldAuswahl from '../../felder/FeldAuswahl'
import FeldText from '../../felder/FeldText'
import { useNachpruefung } from '../../regeln/useNachpruefung'
import { VORFLUTER_PFADE } from '../../regeln/vorfluter'

/* The five Vorfluter boxes are one rule, so a change in any of them can raise
   or clear a message on the others: typing "Rhein" into the second box ends the
   chain and settles the first.

   The box being typed in is deliberately left out. It is checked on blur like
   every other field, and including it would mean announcing that the chain does
   not reach the Rhein while somebody is still typing the word. */
const ketteOhne = (geaendert: string) =>
  VORFLUTER_PFADE.filter((pfad) => pfad !== geaendert)

/* The stretch of water that was fished: which Gewaesser, what kind, how long,
   where, and where its water eventually goes.

   A Probestrecke is its own entity (ADR 0001), surveyed again in later years
   under the same record, which is why these answers describe a place rather than
   a visit. */
function ProbestreckeBlock() {
  const { t } = useTranslation()

  useNachpruefung(VORFLUTER_PFADE, ketteOhne)

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt1.probestrecke.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt1.probestrecke.hinweis')}
      </p>

      <div className="grid">
        <FeldText
          name="probestrecke.gewaesser.gewaessername"
          labelKey="protokoll.abschnitt1.probestrecke.feld.gewaessername"
          spalten={5}
          pflicht
        />
        {/* A radio group in the PDF, a dropdown here, following the mockup:
            eight options with labels this long do not fit the row as radios.
            The code is shown in front of the label because CONTEXT.md, the
            hint below and feature 5's rule all talk in those codes. */}
        <FeldAuswahl
          name="probestrecke.gewaessertyp"
          liste="gewaessertyp"
          mitWert
          labelKey="protokoll.abschnitt1.probestrecke.feld.gewaessertyp"
          hinweisKey="protokoll.abschnitt1.probestrecke.feld.gewaessertypHinweis"
          spalten={4}
          pflicht
        />
        <FeldText
          name="probestrecke.laenge"
          typ="number"
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt1.probestrecke.feld.laenge"
          spalten={3}
          pflicht
        />

        <FeldText
          name="probestrecke.ortsangabe"
          labelKey="protokoll.abschnitt1.probestrecke.feld.ortsangabe"
          spalten={12}
          pflicht
        />
      </div>

      <div className="grid">
        <div className="col-12">
          <p className="callout">
            <strong>
              {t('protokoll.abschnitt1.probestrecke.vorfluterCallout.titel')}
            </strong>{' '}
            {t('protokoll.abschnitt1.probestrecke.vorfluterCallout.text')}
          </p>
        </div>

        {/* Five, not the mockup's three: the PDF has vorfluter1 to vorfluter5
            and project-overview.md caps the chain at five. Only the first is
            marked required; how far the chain has to run depends on where the
            Rhein or the Donau turns up, which regeln/vorfluter.ts decides. */}
        <FeldText
          name="probestrecke.gewaesser.vorfluter1"
          labelKey="protokoll.abschnitt1.probestrecke.feld.vorfluter1"
          spalten={4}
          pflicht
        />
        <FeldText
          name="probestrecke.gewaesser.vorfluter2"
          labelKey="protokoll.abschnitt1.probestrecke.feld.vorfluter2"
          spalten={4}
        />
        <FeldText
          name="probestrecke.gewaesser.vorfluter3"
          labelKey="protokoll.abschnitt1.probestrecke.feld.vorfluter3"
          spalten={4}
        />
        <FeldText
          name="probestrecke.gewaesser.vorfluter4"
          labelKey="protokoll.abschnitt1.probestrecke.feld.vorfluter4"
          spalten={4}
        />
        <FeldText
          name="probestrecke.gewaesser.vorfluter5"
          labelKey="protokoll.abschnitt1.probestrecke.feld.vorfluter5"
          spalten={4}
        />
      </div>

      <div className="grid">
        <div className="col-12">
          <p className="callout">
            <strong>
              {t('protokoll.abschnitt1.probestrecke.koordinatenCallout.titel')}
            </strong>{' '}
            {t('protokoll.abschnitt1.probestrecke.koordinatenCallout.text')}
          </p>
        </div>

        {/* Each boundary is described in words above the numbers that fix it.
            untere and obere are real fields in the PDF that the mockup left out;
            a landmark is what somebody uses to find the same spot next year. */}
        <FeldText
          name="probestrecke.untere"
          labelKey="protokoll.abschnitt1.probestrecke.feld.untere"
          hinweisKey="protokoll.abschnitt1.probestrecke.feld.untereHinweis"
          spalten={6}
        />
        <FeldText
          name="probestrecke.utm_rw_unten"
          typ="number"
          labelKey="protokoll.abschnitt1.probestrecke.feld.utmRwUnten"
          spalten={3}
          pflicht
        />
        <FeldText
          name="probestrecke.utm_hw_unten"
          typ="number"
          labelKey="protokoll.abschnitt1.probestrecke.feld.utmHwUnten"
          spalten={3}
          pflicht
        />

        <FeldText
          name="probestrecke.obere"
          labelKey="protokoll.abschnitt1.probestrecke.feld.obere"
          spalten={6}
        />
        <FeldText
          name="probestrecke.utm_rw_oben"
          typ="number"
          labelKey="protokoll.abschnitt1.probestrecke.feld.utmRwOben"
          spalten={3}
          pflicht
        />
        <FeldText
          name="probestrecke.utm_hw_oben"
          typ="number"
          labelKey="protokoll.abschnitt1.probestrecke.feld.utmHwOben"
          spalten={3}
          pflicht
        />

        <p className="col-12 form-section__hint">
          {t('protokoll.abschnitt1.probestrecke.kartenHinweis')}
        </p>
      </div>
    </fieldset>
  )
}

export default ProbestreckeBlock
