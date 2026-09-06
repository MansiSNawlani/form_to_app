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
 */
function Abschnitt7() {
  return (
    <>
      <KartenausschnittBlock />
      <FotosBlock />
    </>
  )
}

export default Abschnitt7
