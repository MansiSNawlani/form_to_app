import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { klassenPfade } from './tabelle'
import { summeAusWerten } from '../../regeln/arten'
import { istLeer } from '../../regeln/regel'
import type { Antworten, Artnummer } from '../../entwurf/typen'

/* What one catch row currently adds up to, in its Σ cell.
 *
 * Read-only text, not a disabled input. The legacy form uses a read-only field
 * because a PDF has nothing else to draw with; here a disabled box would take a
 * tab stop and be announced as a broken control for a value nobody can edit.
 *
 * An empty row shows nothing rather than 0, on the same grounds as
 * Gesamtsumme: a zero nobody typed is a claim nobody made.
 */

interface ZeilensummeProps {
  nr: Artnummer
}

function Zeilensumme({ nr }: ZeilensummeProps) {
  const { t } = useTranslation()

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and a fresh array every render would resubscribe every render. */
  const pfade = useMemo(() => klassenPfade(nr), [nr])

  /* Scoped to this row's own ten cells, so a keystroke re-renders this total
     and not the row around it. */
  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  const summe = summeAusWerten(werte)

  if (werte.every(istLeer)) return <span className="zeilensumme" />

  /* A row holding something unreadable says so, rather than going blank as an
     untouched row does. Blank for both would hide the problem behind the state
     that means nothing is wrong. The mark is short because the column is, and
     carries the words as its tooltip; Gesamtsumme has room to spell them out. */
  if (summe === undefined) {
    return (
      <span
        className="zeilensumme"
        title={t('protokoll.abschnitt6.tabelle.summeUnbekannt')}
      >
        ?
      </span>
    )
  }

  return <span className="zeilensumme">{summe}</span>
}

export default Zeilensumme
