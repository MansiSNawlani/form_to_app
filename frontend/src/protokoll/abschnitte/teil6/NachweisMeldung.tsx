import { useMemo } from 'react'
import { useFormState, useWatch } from 'react-hook-form'
import { zaehlzelleBeruehrt } from './tabelle'
import { benannteArten, fangOhneNachweisCode } from '../../regeln/arten'
import BlockMeldung from '../../absenden/BlockMeldung'
import type { Antworten } from '../../entwurf/typen'

/* The one thing that can be wrong with the catch table as a whole: it records a
 * species and no animals, without saying that nothing was caught.
 *
 * The message belongs to no cell, because the fix is to pick a "kein Nachweis"
 * entry in place of the species named. Same device as teil3/Gruppensumme.tsx,
 * teil4/EinfluesseWiderspruch.tsx and teil5/PaarMeldung.tsx, and it shares
 * .block-message with the last two. A live region, as they are: one sentence,
 * and nobody is standing on the cell it concerns when it changes.
 *
 * It recomputes rather than reading formState.errors, unlike its neighbour
 * Zellmeldungen. The message hangs at tabelle.arten, which is not a field, and
 * React Hook Form refreshes only the error for the name it is validating, so a
 * message read from there would be a verdict from whenever the document was last
 * validated whole. Calling the rule regeln/schema.ts calls, on the values already
 * being watched, is what teil3/Gruppensumme.tsx settled on for the same reason.
 * The registration in schema.ts stays: it is what makes the document formally
 * invalid for feature 11's gate to read.
 *
 * The cadence is the onTouched one every message on this form follows. The rule
 * turns on every count being zero, which a table passes through while the first 0
 * is still being typed, so it waits until a count cell has been left. A reopened
 * draft needs its own trigger, because ProtokollFormular revalidates on mount
 * without touching anything, so a table that arrived already wrong speaks up
 * straight away.
 */

interface NachweisMeldungProps {
  /** The table's fieldset points at this with aria-describedby. */
  id: string
}

function NachweisMeldung({ id }: NachweisMeldungProps) {
  /* One subscription to the group rather than 312 to its cells. Wide by design
     and acceptable because this is a leaf, the same trade Gesamtsumme.tsx makes:
     a keystroke re-renders this message and no cell. */
  const arten = useWatch<Antworten>({ name: 'arten' }) as Antworten['arten']

  const { touchedFields, defaultValues } = useFormState<Antworten>({ name: 'arten' })

  const schluessel = fangOhneNachweisCode({ arten })[0]?.schluessel

  const vorbefuellt = useMemo(
    () => fangOhneNachweisCode((defaultValues ?? {}) as Antworten).length > 0,
    [defaultValues],
  )

  const sprechen = zaehlzelleBeruehrt(touchedFields.arten) || vorbefuellt

  /* Put right once a species is named and the browser's own rule is quiet. The
     server refuses this table either for naming no species at all or for a
     catch beside a no-detection code, and this reading covers both. */
  const erledigt = benannteArten({ arten }).length > 0 && schluessel === undefined

  return (
    <BlockMeldung
      pfad="tabelle.arten"
      id={id}
      browser={schluessel && sprechen ? schluessel : undefined}
      erledigt={erledigt}
    />
  )
}

export default NachweisMeldung
