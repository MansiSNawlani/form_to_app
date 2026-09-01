import { useTranslation } from 'react-i18next'
import FeldText from '../../felder/FeldText'

/* The person who carried out the Befischung, and how to reach them.

   Their details are typed in here rather than taken from the account, because
   the account that files a protocol is not always the person who did the survey:
   CONTEXT.md makes that distinction, and the data model keeps Person separate
   from User for the same reason. */
function BearbeiterBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt1.bearbeiter.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt1.bearbeiter.hinweis')}
      </p>

      <div className="grid">
        <FeldText
          name="bearbeiter.name"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.name"
          spalten={5}
          pflicht
        />
        <FeldText
          name="bearbeiter.firma"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.firma"
          spalten={7}
        />

        <FeldText
          name="bearbeiter.strasse"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.strasse"
          spalten={6}
        />
        {/* Text, not number: a German postcode can begin with a zero, which a
            number input would drop, and it is never arithmetic. */}
        <FeldText
          name="bearbeiter.plz"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.plz"
          spalten={2}
        />
        {/* Not a field in the legacy PDF, which has a street and a postcode but
            no town. Both the mockup and the Person model have one, so it is
            added here; it is on the list to raise with FFS. */}
        <FeldText
          name="bearbeiter.ort"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.ort"
          spalten={4}
        />

        <FeldText
          name="bearbeiter.telefon"
          typ="tel"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.telefon"
          spalten={4}
        />
        {/* Wider than the mockup's five columns, which were followed there by an
            Anodenfuehrer field. That belongs to ausruestung, so it is feature 8,
            and the e-mail address takes the room instead of leaving a gap. */}
        <FeldText
          name="bearbeiter.email"
          typ="email"
          labelKey="protokoll.abschnitt1.bearbeiter.feld.email"
          spalten={8}
          pflicht
        />
      </div>
    </fieldset>
  )
}

export default BearbeiterBlock
