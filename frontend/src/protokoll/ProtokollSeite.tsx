import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import NotFound from '../components/NotFound'
import ProtokollFormular from './ProtokollFormular'
import { abschnittPfad, findeAbschnitt } from './abschnitte'
import { entwurfStore } from './entwurf/store'
import './protokoll.css'

/* Resolves the URL into a draft and a section, and nothing else. The form
 * itself is a separate component so that this one can decide the two dead-end
 * cases before any form state exists.
 *
 * The draft id and the section both come from the URL, so a section is
 * deep-linkable and the browser's own back button moves between sections
 * without any history handling of our own. */
function ProtokollSeite() {
  const { id, nr } = useParams()
  const { t } = useTranslation()

  // Reading is synchronous today and an API call in feature 3. Memoised on the
  // id so a re-render for any other reason does not re-read storage.
  const entwurf = useMemo(() => (id ? entwurfStore.readEntwurf(id) : null), [id])
  const abschnitt = findeAbschnitt(nr)

  if (entwurf === null) {
    return (
      <NotFound
        title={t('protokoll.nichtGefunden.titel')}
        text={t('protokoll.nichtGefunden.text')}
      />
    )
  }

  // The draft exists and only the section number is wrong, so send the user to
  // the first section rather than to a dead end. replace, so the bad URL does
  // not sit in the history waiting for the back button.
  if (abschnitt === undefined) {
    return <Navigate to={abschnittPfad(entwurf.id, 1)} replace />
  }

  /* Keyed by the draft, so opening a different protocol builds a fresh form
     rather than carrying the previous one's values into it. Switching drafts by
     URL keeps this component mounted; only the key forces the reset. */
  return <ProtokollFormular key={entwurf.id} entwurf={entwurf} abschnitt={abschnitt} />
}

export default ProtokollSeite
