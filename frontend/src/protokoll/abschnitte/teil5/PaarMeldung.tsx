import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Paarpfad } from './bloecke'
import { findePaar, istLeeresPaar } from '../../regeln/ausruestung'
import type { Antworten } from '../../entwurf/typen'

/* What a pair of numbers currently fails to say, shown under the two of them.

   All three of part 5's rules are the same check over a different pair, so this
   is one component used three times rather than three near-identical ones.

   It takes only which pair it is. Both the two fields to watch and the message
   to show come from regeln/ausruestung.ts, so neither can be given here and drift
   from what schema.ts judges. The same arrangement EinfluesseWiderspruch has with
   regeln/einfluesse.ts, where the message is read off the rule's own verdict.

   It speaks as soon as the pair reads zero, without waiting for a field to be
   left. Zero anodes beside zero anodes is never a step on the way to a correct
   answer, unlike a percentage run, which is under 100 all the way up to the
   moment it is finished. */

interface PaarMeldungProps {
  /** The block points at this with aria-describedby. */
  id: string
  paar: Paarpfad
}

function PaarMeldung({ id, paar }: PaarMeldungProps) {
  const { t } = useTranslation()
  const { schluessel } = findePaar(paar)

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and a fresh array every render would mean a fresh subscription
     every render. Keyed on the pair's path rather than on its fields: the path
     is a string, so it compares by value, and the fields behind it are a module
     constant that never changes for a given path. */
  const pfade = useMemo(() => [...findePaar(paar).felder], [paar])

  /* Scoped to these two fields. A wider subscription would re-render the section
     around it on every keystroke, which is the sticky typing at 338 fields that
     coding-standards.md picked React Hook Form to avoid. */
  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  return (
    /* Always rendered, empty when there is nothing to say. A live region added
       to the page at the same moment as its text is unreliably announced; one
       that is already there is not. */
    <p className="block-message" id={id} role="status">
      {istLeeresPaar(werte) ? t(schluessel) : ''}
    </p>
  )
}

export default PaarMeldung
