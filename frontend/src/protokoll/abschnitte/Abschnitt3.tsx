import GewaessersohleBlock from './teil3/GewaessersohleBlock'
import UferBlock from './teil3/UferBlock'
import UmlandBlock from './teil3/UmlandBlock'

/* Section 3: the land around the stretch, the bank, and the bed.
 *
 * No condition anywhere in this section, unlike section 2. A lake has an
 * Umland, a bank and a bed just as a river does, and the legacy form has no
 * handler in part 3 that reads the Gewaessertyp. So nothing here appears or
 * disappears with the water type. */
function Abschnitt3() {
  return (
    <>
      <UmlandBlock />
      <UferBlock />
      <GewaessersohleBlock />
    </>
  )
}

export default Abschnitt3
