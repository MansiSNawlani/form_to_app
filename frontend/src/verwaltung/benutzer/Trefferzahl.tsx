import { useTranslation } from 'react-i18next'

interface TrefferzahlProps {
  /** How many rows are showing, and out of how many. */
  angezeigt: number
  gesamt: number
  /** Whether anything is narrowing the list, by address or by status. */
  gefiltert: boolean
}

/* How many accounts are on screen, and how many there are.
 *
 * **The only count on this screen, and always present.** It says the total when
 * nothing is narrowing the list and "2 von 34" when something is, so one element
 * answers "how many are there" and "how many am I looking at" without either
 * number appearing twice on the page.
 *
 * **Never emptied.** An earlier version left it blank while unsearched, which
 * meant clearing the box announced nothing at all: somebody using a screen reader
 * was told the list had narrowed but never that it had come back. A live region
 * has to keep saying where things stand, not only while they are unusual.
 *
 * Its own component since 2026-09-28. It used to sit inside Suchfeld, which was
 * right while the address was the only thing that narrowed the list; the status
 * filter made it speak for two controls, and a count owned by one of the things it
 * reports on is how it comes to report only that one.
 */
function Trefferzahl({ angezeigt, gesamt, gefiltert }: TrefferzahlProps) {
  const { t } = useTranslation()

  return (
    <p className="benutzer__treffer" role="status">
      {gefiltert
        ? t('benutzerverwaltung.suche.treffer', { count: angezeigt, gesamt })
        : t('benutzerverwaltung.anzahl', { count: gesamt })}
    </p>
  )
}

export default Trefferzahl
