import HydrologieBlock from './teil2/HydrologieBlock'
import MessdatenBlock from './teil2/MessdatenBlock'

/* Section 2: what was measured on the day, then how the stretch behaves.

   Two components rather than one, because feature 5b hides the second for
   standing waters. */
function Abschnitt2() {
  return (
    <>
      <MessdatenBlock />
      <HydrologieBlock />
    </>
  )
}

export default Abschnitt2
