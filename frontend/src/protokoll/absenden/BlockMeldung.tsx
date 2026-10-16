import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { blockAnzeige } from './amFeld'
import { useServerMeldung } from './verstossKontext'

/* The message line under a block: a pair, a tick group, a fished area, the
   catch table. One line for both the browser's own rule and the server's
   refusal at the last submit, so a block never says the same thing twice.

   data-abgelehnt is what outlines the block around it; protokoll.css says how.

   Left without browser and erledigt, it shows the server's refusal alone and
   keeps it until the next submit. That is right for the Einflüsse and
   Bewirtschaftung ticks and the fished areas: their completeness is checked
   only at submit, and none of them can be judged done by looking at one box. */

interface BlockMeldungProps {
  /** The path the server refuses this block under. */
  pfad: string
  /** The block's fieldset points at this with aria-describedby. */
  id: string
  /** What the browser's own rule currently says about the block. */
  browser?: ParseKeys
  /** Whether the block has since been put right, by the block's own reading. */
  erledigt?: boolean
}

function BlockMeldung({ pfad, id, browser, erledigt = false }: BlockMeldungProps) {
  const { t } = useTranslation()
  const server = useServerMeldung(pfad)
  const { meldung, abgelehnt } = blockAnzeige(browser, server, erledigt)

  return (
    /* Always rendered, empty when there is nothing to say. A live region added
       to the page at the same moment as its text is unreliably announced; one
       that is already there is not. */
    <p className="block-message" id={id} role="status" data-abgelehnt={abgelehnt || undefined}>
      {meldung ? t(meldung) : ''}
    </p>
  )
}

export default BlockMeldung
