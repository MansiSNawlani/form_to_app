import ArtenTabelle from './teil6/ArtenTabelle'
import BemerkungFischeBlock from './teil6/BemerkungFischeBlock'
import ArtenNurLesen from '../nurlesen/ArtenNurLesen'
import { useNurLesen } from '../nurlesen/kontext'

/* Section 6, in the order page 3 prints its blocks: the remarks box reads as the
   catch table's introduction, so it comes first here as it does there.

   The catch table is the one block this feature does not render read-only by
   giving its controls a second look. ArtenTabelle is 312 controls with rows that
   grow and shrink, a picker over 123 entries, a live total subscribed per row and
   a remove button on each; none of that survives having nothing to edit, and a
   branch threaded through it would leave both jobs harder to read than either
   alone. The remarks box above needs no such thing: it is a FeldText and already
   knows how to print itself. */
function Abschnitt6() {
  const nurLesen = useNurLesen()

  return (
    <>
      <BemerkungFischeBlock />
      {nurLesen ? <ArtenNurLesen /> : <ArtenTabelle />}
    </>
  )
}

export default Abschnitt6
