import BemerkungenBlock from './teil4/BemerkungenBlock'
import BewirtschaftungBlock from './teil4/BewirtschaftungBlock'
import EinfluesseBlock from './teil4/EinfluesseBlock'
import StrukturenBlock from './teil4/StrukturenBlock'

/* Section 4: what is in the water, what people do with the water, and how it is
 * fished.
 *
 * The one section with no rule of any kind. The legacy form has no handler and
 * no validation anywhere in part 4, so nothing here is summed, required, or
 * shown and hidden with the Gewaessertyp. Fields that accept a value and save
 * it, and that is the whole of it.
 *
 * In the order page 2 prints the four blocks. */
function Abschnitt4() {
  return (
    <>
      <StrukturenBlock />
      <EinfluesseBlock />
      <BewirtschaftungBlock />
      <BemerkungenBlock />
    </>
  )
}

export default Abschnitt4
