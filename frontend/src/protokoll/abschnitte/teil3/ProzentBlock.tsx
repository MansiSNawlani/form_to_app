import type { ParseKeys } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Prozentfeld } from './bloecke'
import FeldProzent from '../../felder/FeldProzent'

/* One run of shares that add up to a whole, such as the nine kinds of bank
   vegetation or the eight bed substrates.

   A fieldset with its own legend rather than a heading and a div, because these
   are groups inside a group. "keine (erkennbar)" is the label of three separate
   fields in section 3, and the legend is the only thing that tells a screen
   reader which one it has landed on.

   Feature 6b gives every one of these a running total and a message when it
   does not come to 100. That is why the five runs share a component rather than
   repeating the same fieldset five times: 6b changes this file once. */

interface ProzentBlockProps {
  legendKey: ParseKeys
  felder: readonly Prozentfeld[]
  /* Anything that belongs to the run without being a share, which so far is
     only the free-text box recording what a "sonstige" share actually was. */
  children?: ReactNode
}

function ProzentBlock({ legendKey, felder, children }: ProzentBlockProps) {
  const { t } = useTranslation()

  return (
    <fieldset className="form-block">
      <legend>{t(legendKey)}</legend>
      <div className="grid">
        {felder.map(({ pfad, labelKey }) => (
          <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
        {children}
      </div>
    </fieldset>
  )
}

export default ProzentBlock
