import { useTranslation } from 'react-i18next'
import BesatzZeilen from './BesatzZeilen'
import { BEWIRTSCHAFTUNG } from './bloecke'
import FeldHaken from '../../felder/FeldHaken'
import FeldText from '../../felder/FeldText'

/* How the water is fished and by whom.

   The component is spelled correctly and every field path inside it is not.
   bewirschaftung is the legacy form's own misspelling of the heading it prints,
   and it is kept because the field paths are what make the eventual FiaKa
   transfer a direct match. Component names are ours; field paths are the form's.
   See defect 10 in docs/ffs-defect-list.md.

   The Fischereiausübungsberechtigter is a contact rather than a name, so the
   printed form gives it three writing lines and a note saying what to put there.
   Both are kept: the box starts three lines tall and the note is the field's
   hint, where a screen reader reaches it too rather than only seeing it in
   print. */
function BewirtschaftungBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt4.bewirtschaftung.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt4.bewirtschaftung.hinweis')}
      </p>

      <div className="grid">
        {BEWIRTSCHAFTUNG.map(({ pfad, labelKey }) => (
          <FeldHaken key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
        <FeldText
          name="bewirschaftung.fischereiausübungsberechtigter"
          labelKey="protokoll.abschnitt4.bewirtschaftung.feld.berechtigter"
          hinweisKey="protokoll.abschnitt4.bewirtschaftung.feld.berechtigterHinweis"
          zeilen={3}
          spalten={12}
        />
      </div>

      <BesatzZeilen />
    </fieldset>
  )
}

export default BewirtschaftungBlock
