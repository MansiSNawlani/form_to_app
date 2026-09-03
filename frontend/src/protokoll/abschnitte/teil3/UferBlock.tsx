import { useTranslation } from 'react-i18next'
import ProzentGruppe from './ProzentGruppe'
import { UFERBEWUCHS, UFERNEIGUNG, UFERVERBAUUNG } from './gruppen'
import FeldHaken from '../../felder/FeldHaken'
import FeldProzent from '../../felder/FeldProzent'
import FeldRadio from '../../felder/FeldRadio'
import FeldText from '../../felder/FeldText'

/* The bank: how it is protected, how steep it is, what grows on it and how it
   has been built up.

   The largest block in the protocol so far, and the first with a structure of
   its own: three runs of shares, each totalling 100 separately, with answers
   between them that belong to no run and are never added up. */
function UferBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt3.ufer.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt3.ufer.hinweis')}
      </p>

      <div className="grid">
        {/* No required marker. The legacy form checks the Gewaessertyp, the
            three Messdaten groups, the nine hydrology groups and five of the
            six percentage blocks at submit, and never this. An asterisk here
            would promise a gate feature 11 has no grounds to build. */}
        <FeldRadio
          name="ufer.randstreifen"
          liste="ufer.randstreifen"
          labelKey="protokoll.abschnitt3.ufer.feld.randstreifen"
          spalten={12}
        />
      </div>

      <ProzentGruppe gruppe={UFERNEIGUNG} />

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
        <FeldHaken
          name="ufer.buhnenbereich"
          labelKey="protokoll.abschnitt3.ufer.feld.buhnenbereich"
          spalten={4}
        />

        <FeldProzent
          name="ufer.wurzeln"
          labelKey="protokoll.abschnitt3.ufer.feld.wurzeln"
          spalten={6}
        />
      </div>

      <ProzentGruppe gruppe={UFERBEWUCHS}>
        {/* Named for the share it explains rather than "Sonstiges". Two fields
            called that sit three rows apart in this section, and a screen
            reader would read them identically. */}
        <FeldText
          name="ufer.sonstiger_bewuchs_text"
          labelKey="protokoll.abschnitt3.ufer.feld.sonstigerBewuchsText"
          spalten={9}
        />
      </ProzentGruppe>

      <ProzentGruppe gruppe={UFERVERBAUUNG}>
        <FeldText
          name="ufer.sonstiger_uferverbau_text"
          labelKey="protokoll.abschnitt3.ufer.feld.sonstigerUferverbauText"
          spalten={9}
        />
      </ProzentGruppe>
    </fieldset>
  )
}

export default UferBlock
