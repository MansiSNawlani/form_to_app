import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ARTNUMMERN, klassenPfade } from './tabelle'
import { summeAusWerten } from '../../regeln/arten'
import { istLeer } from '../../regeln/regel'
import type { Antworten } from '../../entwurf/typen'

/* Everything caught, at the foot of the table.
 *
 * The one wide subscription in section 6: 260 paths, every size class in every
 * row. Deliberate and cheap, because this is a leaf. useWatch re-renders the
 * component that called it and nothing above it, so a keystroke updates this
 * number and its own row's Σ while no cell re-renders at all. Lifting the totals
 * into the table and passing them down would re-render all 312 controls.
 *
 * Blank for an untouched table, 0 once a zero has been typed. Both are 0
 * arithmetically and they mean opposite things: one is a surveyor who has not
 * filled the table in, the other is a surveyor saying they caught nothing.
 * Feature 9b's "no detection" rule turns on that difference.
 */

function Gesamtsumme() {
  const { t } = useTranslation()

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and it matters most here: 260 fresh strings every render would
     resubscribe the widest watch on the page. */
  const pfade = useMemo(() => ARTNUMMERN.flatMap(klassenPfade), [])

  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  const summe = summeAusWerten(werte)

  if (werte.every(istLeer)) return <span className="gesamtsumme" />

  return (
    <span className="gesamtsumme">
      {summe === undefined ? t('protokoll.abschnitt6.tabelle.summeUnbekannt') : summe}
    </span>
  )
}

export default Gesamtsumme
