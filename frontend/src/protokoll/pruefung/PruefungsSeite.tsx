import { Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import ProtokollAnsicht from '../nurlesen/ProtokollAnsicht'
import { abschnittPfad } from '../abschnitte'
import { useProtokollZustand } from '../useProtokollZustand'
import Pruefungsrail from './Pruefungsrail'
import '../protokoll.css'

/* A protocol that has been handed in, read rather than filled in.
 *
 * The reviewer's screen, built against prototypes/pruefung-protokoll.html. It is
 * not only the reviewer's: anybody the server lets read a protocol reaches it,
 * which since feature 11d means a Reviewer, a Data Steward or a Super Admin on
 * somebody else's, and from step 8 the surveyor on their own. **There is no role
 * check here on purpose.** The backend decides who may see what, in one place,
 * and a second opinion in the browser could only ever be the wrong one; hiding a
 * page is not a permission.
 *
 * Nothing on the protocol itself writes: no automatic save, no rules run, no
 * Absenden. The rail beside it is the one part of this screen that does, and
 * only ever to the protocol's status, never to an answer in it.
 */
function PruefungsSeite() {
  const { id } = useParams()
  const { t } = useTranslation()

  /* The four ways this can end before there is a protocol, shared with the
     form's own page. useProtokollZustand says why they live together. */
  const { zustand, protokoll } = useProtokollZustand(id)
  if (zustand !== null || protokoll === undefined) return zustand

  /* Still a draft, so this is the wrong screen for it.
   *
   * It can only be the reader's own: the server refuses a draft to everybody
   * else, and that refusal was handled above. So this is somebody who reached
   * the reviewer's address for a protocol they are still writing, and the form
   * is where they meant to be. replace, so the back button does not bounce them
   * straight back here.
   */
  if (protokoll.status === 'DRAFT') {
    return <Navigate to={abschnittPfad(protokoll.id, 1)} replace />
  }

  return (
    <ProtokollAnsicht
      protokoll={protokoll}
      /* Said once for the whole protocol rather than per section. It is about
         the fields, not about the decision: asking for a correction is the
         reviewer's own move and lives in the rail. */
      hinweis={
        <p className="form-section__hint review__hinweis">
          {t('protokoll.pruefung.gesperrt')}
        </p>
      }
      rail={<Pruefungsrail protokoll={protokoll} />}
    />
  )
}

export default PruefungsSeite
