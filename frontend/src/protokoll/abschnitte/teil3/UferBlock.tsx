import { useTranslation } from 'react-i18next'
import { NEIGUNG, UFERBEWUCHS, UFERVERBAUUNG } from './bloecke'
import FeldHaken from '../../felder/FeldHaken'
import FeldProzent from '../../felder/FeldProzent'
import FeldRadio from '../../felder/FeldRadio'
import FeldText from '../../felder/FeldText'

/* The bank: how it is protected, how steep it is, what grows on it and how it
   has been built up.

   The largest block in the protocol so far, and the first with a structure of
   its own: three percentage runs, each totalling 100 separately, with answers
   between them that belong to no run. Nested fieldsets rather than headings,
   so a screen reader entering the nine Uferbewuchs shares is told that is what
   they are shares of. Without that, "keine (erkennbar)" appears twice in this
   section and again on the bed, with nothing to tell the three apart. */
function UferBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.ufer.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.ufer.hinweis')}
      </p>

      <div className="grid">
        <FeldRadio
          name="ufer.randstreifen"
          liste="ufer.randstreifen"
          labelKey="protokoll.abschnitt3.ufer.feld.randstreifen"
          spalten={12}
          pflicht
        />
      </div>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.ufer.neigung.legend')}</legend>
        <div className="grid">
          {NEIGUNG.map(({ pfad, labelKey }) => (
            <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
          ))}
        </div>
      </fieldset>

      {/* The Damm's own slope, in degrees, and not one of the four shares
          above it despite both being printed as "Neigung". ufer.neigung is the
          legacy path for this one. */}
      <div className="grid">
        <FeldProzent
          name="ufer.streckenanteil_geschuetteter_damm"
          labelKey="protokoll.abschnitt3.ufer.feld.geschuetteterDamm"
          spalten={4}
        />
        <FeldText
          name="ufer.neigung"
          typ="number"
          einheit={t('protokoll.felder.einheit.winkelgrad')}
          labelKey="protokoll.abschnitt3.ufer.feld.dammNeigung"
          spalten={4}
        />
        <div className="field field--haken col-4">
          <FeldHaken
            name="ufer.buhnenbereich"
            labelKey="protokoll.abschnitt3.ufer.feld.buhnenbereich"
          />
        </div>

        <FeldProzent
          name="ufer.wurzeln"
          labelKey="protokoll.abschnitt3.ufer.feld.wurzeln"
          spalten={6}
        />
      </div>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.ufer.bewuchs.legend')}</legend>
        <div className="grid">
          {UFERBEWUCHS.map(({ pfad, labelKey }) => (
            <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
          ))}
          {/* Named for the share it explains rather than "Sonstiges". Two
              fields called that sit three rows apart in this section, and a
              screen reader would read them identically. */}
          <FeldText
            name="ufer.sonstiger_bewuchs_text"
            labelKey="protokoll.abschnitt3.ufer.feld.sonstigerBewuchsText"
            spalten={9}
          />
        </div>
      </fieldset>

      <fieldset className="form-block">
        <legend>{t('protokoll.abschnitt3.ufer.uferverbauung.legend')}</legend>
        <div className="grid">
          {UFERVERBAUUNG.map(({ pfad, labelKey }) => (
            <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
          ))}
          <FeldText
            name="ufer.sonstiger_uferverbau_text"
            labelKey="protokoll.abschnitt3.ufer.feld.sonstigerUferverbauText"
            spalten={9}
          />
        </div>
      </fieldset>
    </fieldset>
  )
}

export default UferBlock
