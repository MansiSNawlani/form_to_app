import Suche from '../../felder/Suche'
import { useFeldFehler } from '../../felder/fehler'
import { fehlerId } from '../../felder/rahmen'
import type { AntwortPfad } from '../../entwurf/typen'

/* The species picker at the head of a catch row.
 *
 * FeldSuche's control without FeldSuche's frame, because a table cell is named
 * by its column heading rather than by a label drawn above it.
 *
 * Changing the species deliberately does not clear the row. The legacy form
 * wipes all eleven counts whenever this field is touched, which loses an
 * afternoon's counting to a surveyor who opened the list to re-read it.
 */

interface ArtZelleProps {
  name: AntwortPfad
  /** The control's whole accessible name, since no visible label points at it. */
  bezeichnung: string
}

function ArtZelle({ name, bezeichnung }: ArtZelleProps) {
  const fehlerKey = useFeldFehler(name)

  return (
    <Suche
      name={name}
      liste="arten"
      className="zelle__suche"
      eingabeAria={{
        'aria-label': bezeichnung,
        'aria-invalid': fehlerKey ? true : undefined,
        'aria-describedby': fehlerId(name, Boolean(fehlerKey)),
      }}
    />
  )
}

export default ArtZelle
