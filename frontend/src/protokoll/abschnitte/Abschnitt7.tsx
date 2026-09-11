import AbsendenBlock from '../absenden/AbsendenBlock'
import type { Bereitsteller } from '../entwurf/bereitstellen'
import type { Anlagenzustand } from '../entwurf/speicherzustand'
import FotosBlock from './teil7/FotosBlock'
import KartenausschnittBlock from './teil7/KartenausschnittBlock'

/* Section 7, the attachments.
 *
 * The one section with no counterpart among the printed form's six parts. The
 * legacy PDF carries its five image slots as buttons rather than as fields, so
 * nothing here belongs in the answers document; an attachment is its own record.
 *
 * The map excerpt comes first because it answers where, which the rest of the
 * protocol has already been describing, and the photographs illustrate it.
 *
 * Absenden sits at the foot of this section, added in feature 11c. It is not an
 * attachment and has nothing to do with the two blocks above it; it is here
 * because this is the end of the protocol, and finishing something belongs at
 * the end of it.
 */
interface Abschnitt7Props {
  entwurfId: string
  bereitstellen: Bereitsteller
  melde: (zustand: Anlagenzustand) => void
  bereitZumAbsenden: () => Promise<number | null>
}

function Abschnitt7({
  entwurfId,
  bereitstellen,
  melde,
  bereitZumAbsenden,
}: Abschnitt7Props) {
  return (
    <>
      {/* Both blocks report to the same indicator. In practice a person works in
          one of them at a time, so the last report is the current one. */}
      <KartenausschnittBlock
        entwurfId={entwurfId}
        bereitstellen={bereitstellen}
        melde={melde}
      />
      <FotosBlock entwurfId={entwurfId} bereitstellen={bereitstellen} melde={melde} />
      <AbsendenBlock entwurfId={entwurfId} bereitZumAbsenden={bereitZumAbsenden} />
    </>
  )
}

export default Abschnitt7
