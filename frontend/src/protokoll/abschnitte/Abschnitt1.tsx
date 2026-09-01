import AnlassBlock from './teil1/AnlassBlock'
import BearbeiterBlock from './teil1/BearbeiterBlock'

/* Section 1: Anlass, Bearbeiter and Probestrecke.

   Three blocks in three files rather than one long one. Twenty-nine fields in a
   single component is past what anyone reads in a sitting, and part 1 is the
   smallest of the six sections.

   Every field is addressed by its legacy PDF path, which is what keeps the
   stored document a direct match for what FiaKa already receives. */
function Abschnitt1() {
  return (
    <>
      <AnlassBlock />
      <BearbeiterBlock />
    </>
  )
}

export default Abschnitt1
