import { useTranslation } from 'react-i18next'
import {
  BEFISCHTE_BEREICHE,
  BREITE_PAAR,
  LAENGE_PAAR,
  type BefischterBereich,
} from './bloecke'
import PaarMeldung from './PaarMeldung'
import FeldHaken from '../../felder/FeldHaken'
import FeldText from '../../felder/FeldText'

/* Which stretch of water was actually fished, in which direction and how.

   The printed form draws this as a table: four column headings over two rows,
   "Über die gesamte Gewässerbreite" and "entlang der Ufer". We do not, and the
   reason is accessibility rather than taste. In a table the only thing telling
   the first row's "watend" from the second row's is which column and row the box
   sits in, and a screen reader reading the checkbox alone gets "watend" twice
   with nothing to separate them. A real table with proper header association
   would fix that, but it would also make the row stack badly on a narrow window,
   and a surveyor filling this in on a laptop at the water is the likelier
   reader.

   So each area is a fieldset with its own legend, and each checkbox carries the
   area in its own label. Longer labels, but every control says what it is
   without depending on where it sits.

   Both rows are optional on their own. What the legacy form requires is at
   least one length across the two rows and at least one width across the two,
   which is regeln/ausruestung.ts rather than anything here. */

interface BereichZeileProps {
  bereich: BefischterBereich
}

function BereichZeile({ bereich }: BereichZeileProps) {
  const { t } = useTranslation()
  const { legendKey, laenge, breite, richtung, methode } = bereich

  return (
    <fieldset className="form-block">
      <legend>{t(legendKey)}</legend>

      <div className="grid">
        <FeldText
          name={laenge}
          typ="number"
          bereich={{ min: 0 }}
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt5.bereiche.feld.laenge"
          spalten={3}
        />
        <FeldText
          name={breite}
          typ="number"
          bereich={{ min: 0 }}
          einheit={t('protokoll.felder.einheit.meter')}
          labelKey="protokoll.abschnitt5.bereiche.feld.breite"
          spalten={3}
        />
      </div>

      {/* Richtung and Methode are the printed form's own two groupings, and they
          are kept because they are the only thing that says these five ticks
          answer two different questions rather than one list of five. */}
      <fieldset className="form-row">
        <legend>{t('protokoll.abschnitt5.bereiche.richtung')}</legend>
        <div className="haken-reihe">
          {richtung.map(({ pfad, labelKey }) => (
            <FeldHaken key={pfad} name={pfad} labelKey={labelKey} />
          ))}
        </div>
      </fieldset>

      <fieldset className="form-row">
        <legend>{t('protokoll.abschnitt5.bereiche.methode')}</legend>
        <div className="haken-reihe">
          {methode.map(({ pfad, labelKey }) => (
            <FeldHaken key={pfad} name={pfad} labelKey={labelKey} />
          ))}
        </div>
      </fieldset>
    </fieldset>
  )
}

const LAENGE_MELDUNG_ID = 'meldung-befischte-laenge'
const BREITE_MELDUNG_ID = 'meldung-befischte-breite'

function BefischteBereicheBlock() {
  const { t } = useTranslation()

  return (
    /* Described by both messages, because both are about the section rather than
       either row: the two lengths are checked against each other across the
       rows, and so are the two widths. That is also why the messages sit here
       and not inside BereichZeile. */
    <fieldset
      className="form-section"
      aria-describedby={`${LAENGE_MELDUNG_ID} ${BREITE_MELDUNG_ID}`}
    >
      <legend>{t('protokoll.abschnitt5.bereiche.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt5.bereiche.hinweis')}
      </p>

      {BEFISCHTE_BEREICHE.map((bereich) => (
        <BereichZeile key={bereich.legendKey} bereich={bereich} />
      ))}

      <PaarMeldung
        id={LAENGE_MELDUNG_ID}
        paar={LAENGE_PAAR}
      />
      <PaarMeldung
        id={BREITE_MELDUNG_ID}
        paar={BREITE_PAAR}
      />
    </fieldset>
  )
}

export default BefischteBereicheBlock
