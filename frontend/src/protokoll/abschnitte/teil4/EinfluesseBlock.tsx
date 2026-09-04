import { useTranslation } from 'react-i18next'
import { EINFLUESSE } from './bloecke'
import EinfluesseWiderspruch from './EinfluesseWiderspruch'
import FeldHaken from '../../felder/FeldHaken'
import FeldText from '../../felder/FeldText'

/* What people do with the water along the stretch.

   Fifteen ticks, and any number of the thirteen named uses may be true at once:
   a stretch can carry both a hydro plant and boat traffic. Nothing here is a
   share and nothing is added up.

   The two at the head of the run are different. "keine (erkennbar)" and
   "unbekannt" are blanket answers, each saying the list below is empty, so
   neither can stand beside a named use or beside the other. That contradiction
   is flagged under the block rather than on a box: see regeln/einfluesse.ts for
   why nothing is cleared and nothing is blocked, and bloecke.ts for why the
   message belongs to the block rather than to any one tick.

   The last tick is printed with no label, just a box at the end of the row and a
   writing line after it, so it is named here for the list it belongs to. */

const WIDERSPRUCH_ID = 'widerspruch-einfluesse'

function EinfluesseBlock() {
  const { t } = useTranslation()

  return (
    /* Described by its message, so reaching the block announces what is
       currently wrong with the combination, without the message announcing
       itself again on every tick. */
    <fieldset className="form-section" aria-describedby={WIDERSPRUCH_ID}>
      <legend>{t('protokoll.abschnitt4.einfluesse.legend')}</legend>
      <p className="form-section__hint">
        {t('protokoll.abschnitt4.einfluesse.hinweis')}
      </p>

      <div className="grid">
        {EINFLUESSE.map(({ pfad, labelKey }) => (
          <FeldHaken key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
        <FeldText
          name="einfluesse.sonstige_nutzung_text"
          labelKey="protokoll.abschnitt4.einfluesse.feld.sonstigeNutzungText"
          spalten={6}
        />
      </div>

      <EinfluesseWiderspruch id={WIDERSPRUCH_ID} />
    </fieldset>
  )
}

export default EinfluesseBlock
