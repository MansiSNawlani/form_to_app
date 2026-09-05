import { useEffect, useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { ZEILENFELDER, artPfad } from './tabelle'
import { istLeer } from '../../regeln/regel'
import type { Antworten, Artnummer } from '../../entwurf/typen'

/* Opens the next row as soon as the last open one is used.
 *
 * A component rather than a hook in ArtenTabelle, and it renders nothing at all.
 * Deciding when to grow means watching the last row's twelve fields, and a
 * useWatch in the table would re-render all 312 controls on every keystroke,
 * which is what a leaf exists to prevent. Here the subscription is the whole
 * component, so a keystroke re-renders this and nothing else.
 *
 * Only the last row is watched, not the table. Whether row 3 of five is empty
 * changes nothing: rows close up when one is removed, so the only row that can
 * make the table grow is the one at the bottom.
 */

interface ZeilenwaechterProps {
  /** The last open row. */
  nr: Artnummer
  onGefuellt: () => void
}

function Zeilenwaechter({ nr, onGefuellt }: ZeilenwaechterProps) {
  const pfade = useMemo(
    () => ZEILENFELDER.map((feld) => artPfad(nr, feld)),
    [nr],
  )

  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]

  const benutzt = !werte.every(istLeer)

  /* In an effect, not during render: growing means setting state on the table
     above, and React warns about updating another component mid-render. */
  useEffect(() => {
    if (benutzt) onGefuellt()
  }, [benutzt, onGefuellt])

  return null
}

export default Zeilenwaechter
