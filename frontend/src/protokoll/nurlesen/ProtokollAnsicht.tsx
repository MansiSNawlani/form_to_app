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
  /* The right-hand column: the Verlauf, and for a reviewer the decision panel
     above it. Optional, because the grid is a two-column grid with one child
     until something is passed, which renders as one column and is what this
     view did for the whole of feature 11e. */
  rail?: ReactNode
}

/* A protocol that has been handed in, shown as it was filed.
 *
 * Shared by two screens that are the same page seen by two people. A reviewer
 * opens it at /protokolle/:id/pruefung to decide on somebody else's survey; the
 * surveyor reaches it at their own protocol's address, where until feature 11e
 * they got a grey notice saying it had been sent and nothing else. Neither is
 * offered anything to change.
 *
 * The two-column grid's second child is the rail, filled in feature 11f. What
 * goes in it differs by screen, which is why it arrives as a slot: the reviewer
 * passes the decision panel and the Verlauf, the surveyor reading their own
 * protocol passes the Verlauf alone.
 */
function ProtokollAnsicht({ protokoll, hinweis, rail }: ProtokollAnsichtProps) {
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

        {rail !== undefined && <div className="rail">{rail}</div>}
      </div>
    </>
  )
}

export default ProtokollAnsicht
