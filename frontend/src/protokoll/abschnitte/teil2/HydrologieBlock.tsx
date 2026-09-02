import { useTranslation } from 'react-i18next'
import FeldHaken from '../../felder/FeldHaken'
import FeldRadio from '../../felder/FeldRadio'
import FeldText from '../../felder/FeldText'
import type { AntwortPfad } from '../../entwurf/typen'
import { useNachpruefung } from '../../regeln/useNachpruefung'

/* Each band picker and the estimate it governs. Choosing a band decides what
   its estimate is allowed to be, so moving the band has to look at the estimate
   again: it can raise a message on an estimate nobody has been back to, and it
   can clear one that no longer applies. */
const SCHAETZWERT_ZU: Partial<Record<AntwortPfad, readonly AntwortPfad[]>> = {
  'hydrologie.breite': ['hydrologie.breite_schaetzwert'],
  'hydrologie.tiefe': ['hydrologie.tiefe_schaetzwert'],
}

const BANDFELDER = Object.keys(SCHAETZWERT_ZU) as AntwortPfad[]
const schaetzwertZu = (geaendert: AntwortPfad) => SCHAETZWERT_ZU[geaendert] ?? []

/* How the water behaves along the stretch: nine judgements, in the order the
   legacy form prints them.

   All nine are bands rather than measurements, which is deliberate in the source
   form: a surveyor standing in a river estimates, and a band that is honestly
   estimated beats a number that is invented.

   No condition anywhere in this component. Whether the block is shown at all
   depends on the Gewaessertyp, and that decision belongs around this block, in
   Abschnitt2, rather than threaded through fifteen fields. */
function HydrologieBlock() {
  const { t } = useTranslation()

  useNachpruefung(BANDFELDER, schaetzwertZu)

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt2.hydrologie.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt2.hydrologie.hinweis')}
      </p>

      <div className="grid">
        <FeldRadio
          name="hydrologie.breite"
          liste="hydrologie.breite"
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.breite"
          spalten={12}
          pflicht
        />
        {/* Under the bands rather than beside them, following the printed form.
            It refines the band, so it is a field of its own and not an option.
            Both estimates are labelled for the band they belong to: two fields
            both called "Schätzwert" would be indistinguishable to a screen
            reader. */}
        <FeldText
          name="hydrologie.breite_schaetzwert"
          typ="number"
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.breiteSchaetzwert"
          hinweisKey="protokoll.abschnitt2.hydrologie.feld.schaetzwertHinweis"
          spalten={4}
        />

        <FeldRadio
          name="hydrologie.tiefe"
          liste="hydrologie.tiefe"
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.tiefe"
          spalten={12}
          pflicht
        />
        <FeldText
          name="hydrologie.tiefe_schaetzwert"
          typ="number"
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.tiefeSchaetzwert"
          hinweisKey="protokoll.abschnitt2.hydrologie.feld.schaetzwertHinweis"
          spalten={4}
        />

        <FeldRadio
          name="hydrologie.tiefenvarianz"
          liste="hydrologie.tiefenvarianz"
          labelKey="protokoll.abschnitt2.hydrologie.feld.tiefenvarianz"
          spalten={12}
          pflicht
        >
          <FeldHaken
            name="hydrologie.mit_flachstellen"
            labelKey="protokoll.abschnitt2.hydrologie.feld.mitFlachstellen"
          />
          <FeldHaken
            name="hydrologie.mit_gumpen"
            labelKey="protokoll.abschnitt2.hydrologie.feld.mitGumpen"
          />
        </FeldRadio>

        <FeldRadio
          name="hydrologie.linienfuehrung"
          liste="hydrologie.linienfuehrung"
          labelKey="protokoll.abschnitt2.hydrologie.feld.linienfuehrung"
          spalten={12}
          pflicht
        >
          <FeldHaken
            name="hydrologie.furkationen"
            labelKey="protokoll.abschnitt2.hydrologie.feld.furkationen"
          />
        </FeldRadio>

        <FeldRadio
          name="hydrologie.stroemung"
          liste="hydrologie.stroemung"
          labelKey="protokoll.abschnitt2.hydrologie.feld.stroemung"
          spalten={12}
          pflicht
        >
          <FeldHaken
            name="hydrologie.rueckstroemung"
            labelKey="protokoll.abschnitt2.hydrologie.feld.rueckstroemung"
          />
        </FeldRadio>

        <FeldRadio
          name="hydrologie.fliessgeschwindigkeit"
          liste="hydrologie.fliessgeschwindigkeit"
          einheit={t('protokoll.felder.einheit.meterProSekunde')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.fliessgeschwindigkeit"
          spalten={12}
          pflicht
        />
        <FeldRadio
          name="hydrologie.wasserfuehrung"
          liste="hydrologie.wasserfuehrung"
          labelKey="protokoll.abschnitt2.hydrologie.feld.wasserfuehrung"
          spalten={12}
          pflicht
        />
        <FeldRadio
          name="hydrologie.stillwasserbereich"
          liste="hydrologie.stillwasserbereich"
          einheit={t('protokoll.felder.einheit.prozent')}
          labelKey="protokoll.abschnitt2.hydrologie.feld.stillwasserbereich"
          spalten={12}
          pflicht
        />
        <FeldRadio
          name="hydrologie.gesamtprofil"
          liste="hydrologie.gesamtprofil"
          labelKey="protokoll.abschnitt2.hydrologie.feld.gesamtprofil"
          spalten={12}
          pflicht
        />
      </div>
    </fieldset>
  )
}

export default HydrologieBlock
