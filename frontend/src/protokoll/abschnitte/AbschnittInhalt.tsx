import Abschnitt1 from './Abschnitt1'
import Abschnitt2 from './Abschnitt2'
import Abschnitt3 from './Abschnitt3'
import Abschnitt4 from './Abschnitt4'
import Abschnitt5 from './Abschnitt5'
import Abschnitt6 from './Abschnitt6'
import type { Abschnitt } from '../abschnitte'

interface AbschnittInhaltProps {
  abschnitt: Abschnitt
}

/* The one place a section number becomes a section body.
 *
 * Every section is real as of feature 9a, so there is no placeholder branch left
 * and no default case: the switch is exhaustive over Abschnitt['nr'], which is
 * what makes a seventh section a build error here rather than a blank page. */
function AbschnittInhalt({ abschnitt }: AbschnittInhaltProps) {
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
  }
}

export default AbschnittInhalt
