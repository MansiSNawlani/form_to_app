import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

interface SuchfeldProps {
  suche: string
  onSuche: (suche: string) => void
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
 * The count used to live here and moved to Trefferzahl.tsx on 2026-09-28, when the
 * status filter arrived: the count speaks for every filter on the row, so it
 * belongs to none of them.
 */
function Suchfeld({ suche, onSuche }: SuchfeldProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    /* FormLabel inside a FormControl, not InputLabel and its notch: the label sits
       above the field on this project, which coding-standards.md settled in
       feature 4a. */
    <FormControl className="benutzer__suchfeld">
      <FormLabel htmlFor={id}>{t('benutzerverwaltung.suche.beschriftung')}</FormLabel>
      <OutlinedInput
        id={id}
        type="search"
        value={suche}
        placeholder={t('benutzerverwaltung.suche.platzhalter')}
        onChange={(ereignis) => onSuche(ereignis.target.value)}
      />
    </FormControl>
  )
}

export default Suchfeld
