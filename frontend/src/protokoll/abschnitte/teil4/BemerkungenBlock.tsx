import { useTranslation } from 'react-i18next'
import FeldText from '../../felder/FeldText'

/* Anything about the stretch that the rest of the section had no box for.

   One field, and it still gets a fieldset and a legend like every other block,
   because by this point in the section there are two other boxes whose label
   begins "sonstige". A legend is what tells a screen reader which of the three
   it has reached.

   It belongs to no build-plan item. It is printed at the foot of page 2,
   directly under the stocking rows, so it lands here rather than being orphaned
   between features 7 and 9. The second remarks box, bemerkung_fische, is printed
   above the catch table on page 3 and belongs to feature 9. */
function BemerkungenBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt4.bemerkungen.legend')}</legend>

      <div className="grid">
        <FeldText
          name="bemerkungen.sonstige_bemerkungen"
          labelKey="protokoll.abschnitt4.bemerkungen.feld.sonstigeBemerkungen"
          zeilen={4}
          spalten={12}
        />
      </div>
    </fieldset>
  )
}

export default BemerkungenBlock
