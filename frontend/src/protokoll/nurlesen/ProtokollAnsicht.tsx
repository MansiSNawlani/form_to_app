import type { ReactNode } from 'react'
import Kopfzeile from '../pruefung/Kopfzeile'
import Uebersichtsleiste from '../pruefung/Uebersichtsleiste'
import ProtokollNurLesen from './ProtokollNurLesen'
import type { Entwurf } from '../entwurf/typen'
import '../protokoll.css'

interface ProtokollAnsichtProps {
  protokoll: Entwurf
  /* The one sentence that differs between the two people who reach this view.
     A reviewer is told the fields are locked; the surveyor whose protocol it is
     is told what its status means and what to do if something still needs
     changing. Everything below it is identical, which is why it is a prop rather
     than a branch. */
  hinweis: ReactNode
}

/* A protocol that has been handed in, shown as it was filed.
 *
 * Shared by two screens that are the same page seen by two people. A reviewer
 * opens it at /protokolle/:id/pruefung to decide on somebody else's survey; the
 * surveyor reaches it at their own protocol's address, where until feature 11e
 * they got a grey notice saying it had been sent and nothing else. Neither is
 * offered anything to change.
 *
 * The two-column grid has one child. Feature 11f puts the decision panel and the
 * Verlauf in the second column, and only the reviewer's screen will pass them, so
 * the rail belongs there rather than as an unused prop here.
 */
function ProtokollAnsicht({ protokoll, hinweis }: ProtokollAnsichtProps) {
  return (
    <>
      <Kopfzeile protokoll={protokoll} />

      <div className="review">
        <div className="review__protokoll">
          <section className="card">
            <Uebersichtsleiste protokoll={protokoll} />
            {hinweis}
          </section>

          <ProtokollNurLesen antworten={protokoll.antworten} entwurfId={protokoll.id} />
        </div>
      </div>
    </>
  )
}

export default ProtokollAnsicht
