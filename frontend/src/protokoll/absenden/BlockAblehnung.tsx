import { useTranslation } from 'react-i18next'
import { blockAnzeige } from './amFeld'
import { useServerMeldung } from './verstossKontext'

/* The server's refusal of a block that has no message line of its own: the
   Einflüsse and Bewirtschaftung ticks, and each fished area. These are only ever
   refused at submit, since completeness is not checked while somebody types, so
   there is no browser message for it to share a line with.

   It stays until the next submit, as the block's entry in the list does: none of
   these can be judged done by looking at one box.

   data-abgelehnt is what outlines the block around it; protokoll.css says how. */

interface BlockAblehnungProps {
  pfad: string
  /** The block's fieldset points at this with aria-describedby. */
  id: string
}

function BlockAblehnung({ pfad, id }: BlockAblehnungProps) {
  const { t } = useTranslation()
  const { meldung, abgelehnt } = blockAnzeige(undefined, useServerMeldung(pfad), false)

  return (
    /* Always rendered, empty when there is nothing to say, for the live region
       reason every block message on this form gives. */
    <p className="block-message" id={id} role="status" data-abgelehnt={abgelehnt || undefined}>
      {meldung ? t(meldung) : ''}
    </p>
  )
}

export default BlockAblehnung
