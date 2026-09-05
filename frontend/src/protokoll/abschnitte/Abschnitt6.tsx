import ArtenTabelle from './teil6/ArtenTabelle'
import BemerkungFischeBlock from './teil6/BemerkungFischeBlock'

/* Section 6, in the order page 3 prints its blocks: the remarks box reads as the
   catch table's introduction, so it comes first here as it does there. */
function Abschnitt6() {
  return (
    <>
      <BemerkungFischeBlock />
      <ArtenTabelle />
    </>
  )
}

export default Abschnitt6
