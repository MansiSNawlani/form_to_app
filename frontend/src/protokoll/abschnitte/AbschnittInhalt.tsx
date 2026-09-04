import Abschnitt1 from './Abschnitt1'
import Abschnitt2 from './Abschnitt2'
import Abschnitt3 from './Abschnitt3'
import Abschnitt4 from './Abschnitt4'
import AbschnittPlatzhalter from './AbschnittPlatzhalter'
import type { Abschnitt } from '../abschnitte'

interface AbschnittInhaltProps {
  abschnitt: Abschnitt
  titel: string
}

/* The one place a section number becomes a section body. Features 5 to 9 each
   add a case here and delete a placeholder, so there is a single file to change
   rather than a condition to find. */
function AbschnittInhalt({ abschnitt, titel }: AbschnittInhaltProps) {
  switch (abschnitt.nr) {
    case 1:
      return <Abschnitt1 />
    case 2:
      return <Abschnitt2 />
    case 3:
      return <Abschnitt3 />
    case 4:
      return <Abschnitt4 />
    default:
      return <AbschnittPlatzhalter title={titel} feature={abschnitt.feature} />
  }
}

export default AbschnittInhalt
