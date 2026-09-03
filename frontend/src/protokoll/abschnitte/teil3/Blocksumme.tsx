import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Prozentblock } from './bloecke'
import { bewerteAnteile } from '../../regeln/prozent'
import type { Antworten } from '../../entwurf/typen'

/* What a run of shares currently adds up to, under the run.
 *
 * The legacy form's device here is a red star that turns into a green tick. A
 * number is more use: "Summe: 83 %" says how far off the answer is, and a tick
 * does not.
 *
 * The message only appears once the run is over 100. Under 100 is what every
 * run looks like while it is being filled in, so objecting to it would mean
 * objecting to normal typing; the total itself is the signal there, and the
 * document is already invalid for it, which is what feature 11's submit gate
 * will read. Over 100 cannot become right by typing more, so it is said at once.
 *
 * Judged by the same bewerteAnteile the schema uses, so the number on screen and
 * the document's validity can never disagree.
 */

interface BlocksummeProps {
  block: Prozentblock
  /** The run's fieldset points at this with aria-describedby. */
  id: string
}

function Blocksumme({ block, id }: BlocksummeProps) {
  const { t } = useTranslation()

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and a fresh array every render would mean a fresh subscription
     every render. The blocks are module constants, so this never recomputes. */
  const pfade = useMemo(() => block.felder.map(({ pfad }) => pfad), [block])

  /* Scoped to this run's own shares. A wider watch would re-render the section
     around it on every keystroke, which is the sticky typing at 338 fields that
     coding-standards.md picked React Hook Form to avoid. */
  /* useWatch resolves a name array that is not a literal tuple to the union of
     every value in the document, groups included. AntwortPfad is by
     construction only the paths whose value is a string, so this narrows back
     to what these paths can actually hold. */
  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  const { summe, verstoesse } = bewerteAnteile(block, werte)
  const zuviel = summe > 100
  const vollstaendig = summe === 100 && verstoesse.length === 0

  const zustand = zuviel ? ' blocksumme--zuviel' : vollstaendig ? ' blocksumme--voll' : ''

  return (
    <p className={`blocksumme${zustand}`} id={id}>
      <span className="blocksumme__wert">{t('protokoll.abschnitt3.summe', { summe })}</span>
      {/* Always rendered, empty when there is nothing to say. A live region that
          is added to the page at the same moment as its text is unreliably
          announced; one that is already there is not. */}
      <span className="blocksumme__meldung" role="status">
        {zuviel ? t('protokoll.regeln.prozentsummeNichtHundert') : ''}
      </span>
    </p>
  )
}

export default Blocksumme
