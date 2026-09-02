import HydrologieBlock from './teil2/HydrologieBlock'
import MessdatenBlock from './teil2/MessdatenBlock'

/* Section 2: the readings taken at the water, and the hydrology of the stretch.

   Two blocks in two files for the same reason section 1 has three: twenty-one
   fields in one component is past what anyone reads in a sitting.

   Messdaten describes the visit, Hydrologie describes the stretch. Feature 5b
   hides the second one for standing waters, which is why they are separate
   components and not one long list of fields. */
function Abschnitt2() {
  return (
    <>
      <MessdatenBlock />
      <HydrologieBlock />
    </>
  )
}

export default Abschnitt2
