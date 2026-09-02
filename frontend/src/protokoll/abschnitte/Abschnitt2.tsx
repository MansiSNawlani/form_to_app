import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import HydrologieBlock from './teil2/HydrologieBlock'
import MessdatenBlock from './teil2/MessdatenBlock'
import type { Antworten } from '../entwurf/typen'
import { istStehendesGewaesser } from '../regeln/hydrologie'

/* Section 2: what was measured on the day, then how the stretch behaves.
 *
 * The second block only applies to a flowing water. The answers behind it are
 * put right by useHydrologieAbgleich, which runs whether or not this section is
 * open; all this decides is what is on screen.
 *
 * The legend stays either way. A section that vanished without trace would read
 * as a form that had lost something, where what actually happened is that the
 * questions do not apply to a lake. */
function Abschnitt2() {
  const { t } = useTranslation()
  const gewaessertyp = useWatch<Antworten, 'probestrecke.gewaessertyp'>({
    name: 'probestrecke.gewaessertyp',
  })

  return (
    <>
      <MessdatenBlock />
      {istStehendesGewaesser(gewaessertyp) ? (
        <fieldset className="form-section">
          <legend>{t('protokoll.abschnitt2.hydrologie.legend')}</legend>
          <p className="callout">
            {t('protokoll.abschnitt2.hydrologie.nichtRelevant')}
          </p>
        </fieldset>
      ) : (
        <HydrologieBlock />
      )}
    </>
  )
}

export default Abschnitt2
