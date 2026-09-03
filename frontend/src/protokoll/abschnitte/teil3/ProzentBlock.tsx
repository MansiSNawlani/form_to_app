import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Blocksumme from './Blocksumme'
import { summeId, type Prozentblock } from './bloecke'
import FeldProzent from '../../felder/FeldProzent'

/* One run of shares that add up to a whole, such as the nine kinds of bank
   vegetation or the eight bed substrates.

   A fieldset with its own legend rather than a heading and a div, because these
   are groups inside a group. "keine (erkennbar)" is the label of three separate
   fields in section 3, and the legend is the only thing that tells a screen
   reader which one it has landed on.

   Handed the whole block rather than a legend and a list, because the running
   total and the block's own message are addressed by the block's id. Passing
   the three separately would let a caller pair one block's fields with another
   block's id, and the mismatch would only show as a message on the wrong run. */

interface ProzentBlockProps {
  block: Prozentblock
  /* Anything that belongs to the run without being a share, which so far is
     only the free-text box recording what a "sonstige" share actually was. */
  children?: ReactNode
}

function ProzentBlock({ block, children }: ProzentBlockProps) {
  const { t } = useTranslation()

  const summe = summeId(block)

  return (
    /* Described by the total, so reaching the run announces what it has to add
       up to and where it currently stands, without the total announcing itself
       again on every keystroke. */
    <fieldset className="form-block" aria-describedby={summe}>
      <legend>{t(block.legendKey)}</legend>
      <div className="grid">
        {block.felder.map(({ pfad, labelKey }) => (
          <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
        {children}
      </div>
      <Blocksumme block={block} id={summe} />
    </fieldset>
  )
}

export default ProzentBlock
