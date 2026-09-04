import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { EINFLUESSE } from './bloecke'
import { pruefeWiderspruch } from '../../regeln/einfluesse'
import type { Antworten } from '../../entwurf/typen'

/* What the Einflüsse block currently contradicts about itself, shown under it.

   Judged by the same pruefeWiderspruch regeln/schema.ts uses, so the message on
   screen and the document's validity cannot disagree.

   It speaks as soon as the contradiction exists, unlike part 3's running total,
   which waits until a share has been left. A percentage run is under 100 all the
   way up to the moment it is finished, so objecting early would object to normal
   typing. There is no equivalent half-finished state here: "keine (erkennbar)"
   beside a named use is never a step on the way to a correct answer. */

interface EinfluesseWiderspruchProps {
  /** The block's fieldset points at this with aria-describedby. */
  id: string
}

function EinfluesseWiderspruch({ id }: EinfluesseWiderspruchProps) {
  const { t } = useTranslation()

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and a fresh array every render would mean a fresh subscription
     every render. EINFLUESSE is a module constant, so this never recomputes. */
  const pfade = useMemo(() => EINFLUESSE.map(({ pfad }) => pfad), [])

  /* Scoped to this block's own ticks. A wider subscription would re-render the
     section around it on every change, which is the sticky typing at 338 fields
     coding-standards.md picked React Hook Form to avoid. */
  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  /* The rule reads an answers document, and useWatch hands back a flat list in
     the run's own order, so the ticks are put back under their keys. Only this
     group is rebuilt: no other rule reads it, and every path here is one level
     deep under einfluesse. */
  const einfluesse = Object.fromEntries(
    EINFLUESSE.map(({ pfad }, index) => [pfad.slice('einfluesse.'.length), werte[index]]),
  ) as Antworten['einfluesse']

  const [verstoss] = pruefeWiderspruch({ einfluesse })

  return (
    /* Always rendered, empty when there is nothing to say. A live region added
       to the page at the same moment as its text is unreliably announced; one
       that is already there is not. */
    <p className="block-message" id={id} role="status">
      {verstoss ? t(verstoss.schluessel) : ''}
    </p>
  )
}

export default EinfluesseWiderspruch
