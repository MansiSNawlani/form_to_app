import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import type { ParseKeys } from 'i18next'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { KONTOSTATUS, type Kontostatus } from './suche'

interface StatusfilterProps {
  status: Kontostatus
  onStatus: (status: Kontostatus) => void
}

/* Showing all accounts, only the ones that can sign in, or only the locked ones.
 *
 * **It holds no state and it fires no request**, the same as the search box beside
 * it: the whole list is already in hand, because feature 16a's endpoint takes no
 * parameters and returns every account. Choosing a status is a filter over an
 * array.
 *
 * **Why it earns its place.** An account is never deleted in this application,
 * only locked, so the locked ones accumulate for as long as the installation runs
 * and every one of them stays in this table. The question an administrator arrives
 * with is "somebody cannot sign in, is it their account or their password", and
 * answering it by scanning a column of badges gets slower every year.
 *
 * The three options are built from KONTOSTATUS rather than typed out here, so what
 * the control offers and what the filter accepts cannot drift apart.
 */
function Statusfilter({ status, onStatus }: StatusfilterProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    /* FormLabel inside a FormControl, not InputLabel and its notch: the label sits
       above the field on this project, which coding-standards.md settled in
       feature 4a. */
    <FormControl className="benutzer__status">
      <FormLabel id={`${id}-label`} htmlFor={id}>
        {t('benutzerverwaltung.statusfilter.beschriftung')}
      </FormLabel>
      <Select
        value={status}
        onChange={(ereignis) => onStatus(ereignis.target.value as Kontostatus)}
        /* The control somebody reaches with the keyboard is a div with
           role="combobox", not an input, so <label for> cannot name it. These two
           props are the wiring that does; an id passed the ordinary way lands on
           MUI's hidden input and leaves the real control nameless. Feature 12b
           shipped four dropdowns in exactly that state. */
        labelId={`${id}-label`}
        SelectDisplayProps={{ id }}
      >
        {KONTOSTATUS.map((wert) => (
          <MenuItem key={wert} value={wert}>
            {t(`benutzerverwaltung.statusfilter.${wert}` satisfies ParseKeys)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default Statusfilter
