import Abschnitt1 from './Abschnitt1'
import Abschnitt2 from './Abschnitt2'
import Abschnitt3 from './Abschnitt3'
import Abschnitt4 from './Abschnitt4'
import Abschnitt5 from './Abschnitt5'
import Abschnitt6 from './Abschnitt6'
import Abschnitt7 from './Abschnitt7'
import type { Abschnitt } from '../abschnitte'

interface AbschnittInhaltProps {
  abschnitt: Abschnitt
  /* Only section 7 needs it. Passed as a prop rather than put in a context
     because one consumer is not a reason to make the draft ambient. */
  entwurfId: string
}

/* The one place a section number becomes a section body.
 *
 * Every section is real as of feature 9a, so there is no placeholder branch left
 * and no default case: the switch is exhaustive over Abschnitt['nr'], which is
 * what made adding section 7 in feature 10 a build error here rather than a
 * blank page, and would do the same for an eighth. */
function AbschnittInhalt({ abschnitt, entwurfId }: AbschnittInhaltProps) {
  switch (abschnitt.nr) {
    case 1:
      return <Abschnitt1 />
    case 2:
      return <Abschnitt2 />
    case 3:
      return <Abschnitt3 />
    case 4:
      return <Abschnitt4 />
    case 5:
      return <Abschnitt5 />
    case 6:
      return <Abschnitt6 />
    case 7:
      return <Abschnitt7 entwurfId={entwurfId} />
  }
}

export default AbschnittInhalt
