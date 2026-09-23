import { ABSCHNITTSKOERPER } from './koerper'
import type { Bereitsteller } from '../entwurf/bereitstellen'
import type { Anlagenzustand } from '../entwurf/speicherzustand'
import Abschnitt7 from './Abschnitt7'
import type { Abschnitt } from '../abschnitte'

interface AbschnittInhaltProps {
  abschnitt: Abschnitt
  /* Only section 7 needs it. Passed as a prop rather than put in a context
     because one consumer is not a reason to make the draft ambient. */
  entwurfId: string
  /* Only section 7 uses it, but the switch is exhaustive and one prop is
     cheaper than a second path through this component. */
  bereitstellen: Bereitsteller
  melde: (zustand: Anlagenzustand) => void
  /* Section 7's too, for the Absenden button at its foot. Travels the same way
     and for the same reason as the two above it. */
  absenden: () => void
  absendenLaeuft: boolean
  /* Section 7's as well: how many pictures an imported PDF carries that did not
     come with it. Zero for every protocol nobody imported. */
  fehlendeBilder: number
}

/* One section of the form, with everything section 7 needs to upload a file.
 *
 * The six ordinary sections come from the shared table in koerper.ts, which
 * feature 11e lifted out when the reviewer's page became the second thing that
 * turns a section number into a section. The table is keyed by the section
 * numbers, so an eighth section is a build error there rather than a blank page
 * here, which is what the exhaustive switch this replaced was for.
 *
 * Section 7 stays a case of its own because it is the only one that takes props,
 * and because its props are all about writing: an id to upload against, a
 * provider, and the Absenden button at its foot. */
function AbschnittInhalt({
  abschnitt,
  entwurfId,
  bereitstellen,
  melde,
  absenden,
  absendenLaeuft,
  fehlendeBilder,
}: AbschnittInhaltProps) {
  if (abschnitt.nr === 7) {
    return (
      <Abschnitt7
        entwurfId={entwurfId}
        bereitstellen={bereitstellen}
        melde={melde}
        absenden={absenden}
        absendenLaeuft={absendenLaeuft}
        fehlendeBilder={fehlendeBilder}
      />
    )
  }

  const Koerper = ABSCHNITTSKOERPER[abschnitt.nr]
  return <Koerper />
}

export default AbschnittInhalt
