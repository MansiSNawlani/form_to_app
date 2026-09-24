import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

interface SuchfeldProps {
  suche: string
  onSuche: (suche: string) => void
  /** How many rows are showing, and out of how many. */
  angezeigt: number
  gesamt: number
}

/* Narrowing the list by address.
 *
 * **It holds no state and it fires no request.** The whole list is already in
 * hand, so every keystroke is a filter over an array: no debounce, no loading
 * state, and nothing to keep in the address bar. Deliberately unlike the review
 * queue's search box, where a request depends on the term, where a filtered queue
 * is worth sharing as a link, and where feature 12d has to rebuild the list from a
 * URL alone. None of those three hold here.
 *
 * **The label names the field rather than saying "Suche"**, so nobody types a role
 * into it and concludes the list is broken.
 *
 * The count beside it is a live region. Typing changes how many rows there are,
 * and somebody who cannot see the table needs to be told that rather than left on
 * a table that silently changed under them.
 */
function Suchfeld({ suche, onSuche, angezeigt, gesamt }: SuchfeldProps) {
  const { t } = useTranslation()
  const id = useId()

  /* Taken from the trimmed term, the same one the filter itself uses, so the
     count cannot claim the list is narrowed by a boxful of spaces. */
  const gefiltert = suche.trim() !== ''

  return (
    <div className="benutzer__suche">
      {/* FormLabel inside a FormControl, not InputLabel and its notch: the label
          sits above the field on this project, which coding-standards.md settled
          in feature 4a. */}
      <FormControl>
        <FormLabel htmlFor={id}>{t('benutzerverwaltung.suche.beschriftung')}</FormLabel>
        <OutlinedInput
          id={id}
          type="search"
          value={suche}
          placeholder={t('benutzerverwaltung.suche.platzhalter')}
          onChange={(ereignis) => onSuche(ereignis.target.value)}
        />
      </FormControl>

      {/* The only count on this screen, and always present.
       *
       * It says the total when nothing is being searched for and "2 von 34" when
       * something is, so one element answers "how many are there" and "how many
       * am I looking at" without either number appearing twice on the page.
       *
       * **Never emptied.** An earlier version left it blank while unsearched,
       * which meant clearing the box announced nothing at all: somebody using a
       * screen reader was told the list had narrowed but never that it had come
       * back. A live region has to keep saying where things stand, not only while
       * they are unusual. */}
      <p className="benutzer__treffer" role="status">
        {gefiltert
          ? t('benutzerverwaltung.suche.treffer', { count: angezeigt, gesamt })
          : t('benutzerverwaltung.anzahl', { count: gesamt })}
      </p>
    </div>
  )
}

export default Suchfeld
