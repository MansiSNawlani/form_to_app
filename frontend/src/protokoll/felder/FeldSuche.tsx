import FeldRahmen from './FeldRahmen'
import Suche from './Suche'
import { useFeldFehler } from './fehler'
import { feldAria, type FeldRahmenProps } from './rahmen'
import type { ListenName } from '../optionen'
import type { AntwortPfad } from '../entwurf/typen'

/* The same thing as FeldAuswahl, for a list too long to scroll.

   The Monitoringstrecken-Nr. has 722 entries and the species list has 123, so a
   dropdown is unusable and a search is the only workable control. What is stored
   is still the export value, not the label the user typed against.

   The control itself is Suche.tsx, shared with part 6's ArtZelle. What this file
   adds is the frame around it: the label above, the required flag, the hint and
   the error, which is the shape every ordinary field on the protocol has and the
   one thing a control in a table cell must not have. */

interface FeldSucheProps extends Omit<FeldRahmenProps, 'id'> {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  liste: ListenName
}

function FeldSuche({
  name,
  liste,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
}: FeldSucheProps) {
  const fehlerKey = useFeldFehler(name)

  return (
    <FeldRahmen
      id={name}
      labelFuer={name}
      labelKey={labelKey}
      spalten={spalten}
      pflicht={pflicht}
      hinweisKey={hinweisKey}
      fehlerKey={fehlerKey}
    >
      <Suche
        name={name}
        liste={liste}
        eingabeAria={feldAria(name, pflicht, hinweisKey, fehlerKey)}
      />
    </FeldRahmen>
  )
}

export default FeldSuche
