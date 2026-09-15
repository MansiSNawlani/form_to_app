import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import Kopfzeile from './Kopfzeile'
import Uebersichtsleiste from './Uebersichtsleiste'
import ProtokollNurLesen from '../nurlesen/ProtokollNurLesen'
import ProtokollLadefehler from '../ProtokollLadefehler'
import ProtokollNichtGefunden from '../ProtokollNichtGefunden'
import { abschnittPfad } from '../abschnitte'
import { entwurfsAbfrage } from '../entwurf/abfragen'
import { ApiFehler, PROTOKOLL_NICHT_GEFUNDEN } from '../../api/fehler'
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
 * Nothing on this page writes. No automatic save, no rules run, no Absenden. The
 * decision panel and the Verlauf go in the empty right-hand column and are
 * feature 11f.
 */
function PruefungsSeite() {
  const { id } = useParams()
  const { t } = useTranslation()

  const {
    data: protokoll,
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery(entwurfsAbfrage(id))

  /* The route pattern always supplies an id, so this is a guard rather than a
     case anybody reaches. It matters because the query is disabled without one
     and a disabled query stays pending forever, which would leave the page on
     "wird geladen" and never move. ProtokollSeite carries the same guard for the
     same reason. */
  if (id === undefined) {
    return <ProtokollNichtGefunden />
  }

  if (isPending) {
    /* A live region, so somebody using a screen reader is told the page is
       working rather than left on a heading that never changes. */
    return (
      <Typography variant="body1" role="status">
        {t('protokoll.laedt')}
      </Typography>
    )
  }

  /* No such protocol, or one this account may not see. The backend answers the
     two identically on purpose, so a stranger cannot discover which ids are
     real, and **this must not be softened into "you have no permission"**: that
     sentence is itself the fact being withheld. */
  if (error instanceof ApiFehler && error.code === PROTOKOLL_NICHT_GEFUNDEN) {
    return <ProtokollNichtGefunden />
  }

  /* Everything else: the backend is down, the network dropped, the session ran
     out. Nothing is wrong with the protocol itself, so this offers the way back
     in rather than claiming it is gone. */
  if (error !== null || protokoll === undefined) {
    return (
      <ProtokollLadefehler fehler={error} laeuft={isFetching} onErneut={() => void refetch()} />
    )
  }

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
    <>
      <Kopfzeile protokoll={protokoll} />

      {/* Two columns, the protocol and a rail. The rail is empty until feature
          11f fills it; a grid with one child renders one column, so nothing here
          is rebuilt when the second arrives. */}
      <div className="review">
        <div className="review__protokoll">
          <section className="card">
            <Uebersichtsleiste protokoll={protokoll} />
            {/* Said once for the whole protocol rather than per section, and
                without naming a way to change it: asking for a correction is the
                reviewer's move and is feature 11f's, while from step 9 the person
                reading this may be the surveyor, for whom that sentence would be
                simply wrong. */}
            <p className="form-section__hint review__hinweis">
              {t('protokoll.pruefung.gesperrt')}
            </p>
          </section>

          <ProtokollNurLesen antworten={protokoll.antworten} />
        </div>
      </div>
    </>
  )
}

export default PruefungsSeite
