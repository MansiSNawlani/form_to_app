import { useTranslation } from 'react-i18next'
import { ANODEN_PAAR, NETZE } from './bloecke'
import PaarMeldung from './PaarMeldung'
import FeldAuswahl from '../../felder/FeldAuswahl'
import FeldHaken from '../../felder/FeldHaken'
import FeldRadio from '../../felder/FeldRadio'
import FeldSuche from '../../felder/FeldSuche'
import FeldText from '../../felder/FeldText'

/* The gear the survey was carried out with.

   Four runs rather than one long grid, because the printed form asks four
   different things here and a screen reader arriving at "Vorname" needs to know
   it is the Anodenführer's. Each nested fieldset says which.

   The E-Gerät is a search rather than a dropdown: 34 device models whose names
   are all of the form "Efko / FEG 3000" are faster to type at than to scroll
   through, and the Kathodentyp beside it is a plain dropdown at nine short
   words. The same rule part 1 set for the Monitoringstrecken-Nr.

   Bauweise is the one question on this form that the printed original does not
   ask in words: two buttons with no text beside them, which it still refuses to
   submit without. Its option labels here repeat the wording of that form's own
   error message and nothing more. See defect 11 in docs/ffs-defect-list.md,
   which is where the question to FFS lives. */

const ANODEN_MELDUNG_ID = 'meldung-anoden'

function AusruestungBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt5.ausruestung.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt5.ausruestung.hinweis')}
      </p>

      <div className="grid">
        <FeldSuche
          name="ausruestung.egeraet"
          liste="ausruestung.egeraet"
          labelKey="protokoll.abschnitt5.ausruestung.feld.egeraet"
          spalten={6}
          pflicht
        />
        <FeldText
          name="ausruestung.spannung"
          typ="number"
          bereich={{ min: 0 }}
          einheit={t('protokoll.felder.einheit.volt')}
          labelKey="protokoll.abschnitt5.ausruestung.feld.spannung"
          spalten={3}
        />
        <FeldText
          name="ausruestung.leistung"
          typ="number"
          bereich={{ min: 0 }}
          einheit={t('protokoll.felder.einheit.kilowatt')}
          labelKey="protokoll.abschnitt5.ausruestung.feld.leistung"
          spalten={3}
        />
        <FeldRadio
          name="ausruestung.bauweise"
          liste="ausruestung.bauweise"
          labelKey="protokoll.abschnitt5.ausruestung.feld.bauweise"
          spalten={12}
          pflicht
        />
      </div>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt5.anodenfuehrer.legend')}</legend>
        <div className="grid">
          <FeldText
            name="anodenfuehrer.vorname"
            labelKey="protokoll.abschnitt5.anodenfuehrer.feld.vorname"
            spalten={6}
          />
          <FeldText
            name="anodenfuehrer.nachname"
            labelKey="protokoll.abschnitt5.anodenfuehrer.feld.nachname"
            spalten={6}
          />
        </div>
      </fieldset>

      {/* Described by its message, so reaching the run announces that neither
          anode count says anything, without the message announcing itself again
          on every keystroke. */}
      <fieldset className="form-block" aria-describedby={ANODEN_MELDUNG_ID}>
        <legend>{t('protokoll.abschnitt5.anoden.legend')}</legend>
        <div className="grid">
          {/* A floor of 0 and no ceiling: what counts as too many anodes or too
              wide a ring is a question for FFS, and guessing it would put a
              limit in the interface that no rule backs. */}
          <FeldText
            name="ausruestung.ringanoden"
            typ="number"
            bereich={{ min: 0 }}
            labelKey="protokoll.abschnitt5.anoden.feld.ringanoden"
            spalten={3}
          />
          <FeldText
            name="ausruestung.ringanoden_durchmesser"
            typ="number"
            bereich={{ min: 0 }}
            einheit={t('protokoll.felder.einheit.zentimeter')}
            labelKey="protokoll.abschnitt5.anoden.feld.ringanodenDurchmesser"
            spalten={3}
          />
          <FeldText
            name="ausruestung.streifenanoden"
            typ="number"
            bereich={{ min: 0 }}
            labelKey="protokoll.abschnitt5.anoden.feld.streifenanoden"
            spalten={3}
          />
          <FeldAuswahl
            name="ausruestung.kathode"
            liste="ausruestung.kathode"
            labelKey="protokoll.abschnitt5.anoden.feld.kathode"
            spalten={3}
          />
        </div>

        <PaarMeldung id={ANODEN_MELDUNG_ID} paar={ANODEN_PAAR} />
      </fieldset>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt5.netze.legend')}</legend>
        <div className="haken-reihe">
          {NETZE.map(({ pfad, labelKey }) => (
            <FeldHaken key={pfad} name={pfad} labelKey={labelKey} />
          ))}
        </div>
      </fieldset>
    </fieldset>
  )
}

export default AusruestungBlock
