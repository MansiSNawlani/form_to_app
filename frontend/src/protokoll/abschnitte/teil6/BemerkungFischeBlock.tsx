import { useTranslation } from 'react-i18next'
import FeldText from '../../felder/FeldText'

/* Anything about the fishing or the fish stock that the catch table has no
   column for.

   One field, and it still gets a fieldset and a legend, for the same reason
   teil4/BemerkungenBlock.tsx does: this is the protocol's second remarks box and
   a bare "Ergänzende Anmerkungen" would read identically to the first one at the
   foot of page 2. The legend says which.

   It is printed directly above the catch table, where it reads as the table's
   introduction, so it is rendered first here too. Feature 8 held it back for
   exactly this reason rather than filing it with part 5's equipment. */
function BemerkungFischeBlock() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.abschnitt6.bemerkung.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt6.bemerkung.hinweis')}
      </p>

      <div className="grid">
        <FeldText
          name="bemerkungen.bemerkung_fische"
          labelKey="protokoll.abschnitt6.bemerkung.feld"
          zeilen={4}
          spalten={12}
        />
      </div>
    </fieldset>
  )
}

export default BemerkungFischeBlock
