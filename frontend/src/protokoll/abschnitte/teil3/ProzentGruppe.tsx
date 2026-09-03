import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Gruppensumme from './Gruppensumme'
import { summeId, type Prozentgruppe } from './gruppen'
import FeldProzent from '../../felder/FeldProzent'

/* One run of shares that add up to a whole, such as the nine kinds of bank
   vegetation or the eight bed substrates.

   A fieldset with its own legend rather than a heading and a div, because these
   are groups inside a group. "keine (erkennbar)" is the label of three separate
   fields in section 3, and the legend is the only thing that tells a screen
   reader which one it has landed on.

   Handed the whole gruppe rather than a legend and a list, because the running
   total and the group's own message are addressed by the group's id. Passing
   the three separately would let a caller pair one group's fields with another
   group's id, and the mismatch would only show as a message on the wrong run. */

interface ProzentGruppeProps {
  gruppe: Prozentgruppe
  /* Anything that belongs to the run without being a share, which so far is
     only the free-text box recording what a "sonstige" share actually was. */
  children?: ReactNode
}

function ProzentGruppe({ gruppe, children }: ProzentGruppeProps) {
  const { t } = useTranslation()

  const summe = summeId(gruppe)

  return (
    /* Described by the total, so reaching the run announces what it has to add
       up to and where it currently stands, without the total announcing itself
       again on every keystroke. */
    <fieldset className="form-block" aria-describedby={summe}>
      <legend>{t(gruppe.legendKey)}</legend>
      <div className="grid">
        {gruppe.felder.map(({ pfad, labelKey }) => (
          <FeldProzent key={pfad} name={pfad} labelKey={labelKey} spalten={3} />
        ))}
        {children}
      </div>
      <Gruppensumme gruppe={gruppe} id={summe} />
    </fieldset>
  )
}

export default ProzentGruppe
