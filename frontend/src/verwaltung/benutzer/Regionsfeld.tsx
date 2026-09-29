import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { useTranslation } from 'react-i18next'
import { optionen } from '../../protokoll/optionen'
import { fehlerId, labelId } from '../../protokoll/felder/rahmen'

interface RegionsfeldProps {
  /** The chosen number as a string, or '' for nothing chosen. */
  wert: string
  onAendern: (wert: string) => void
  meldung?: string
}

/* Which Regierungspraesidium a regional account belongs to.
 *
 * Presentational, and it knows nothing about either form it appears in: the
 * caller wraps it in its own Controller and decides whether to draw it at all.
 * That is what lets the create screen and the edit screen share it, which they
 * must, because the wiring below is the part that is easy to get subtly wrong and
 * impossible to notice.
 *
 * **The label wiring is the reason this is a component rather than a snippet.**
 * What somebody reaches with the keyboard is a div with role="combobox", not an
 * input, so <label for> cannot name it: labelId and SelectDisplayProps are what
 * do. An id passed the ordinary way lands on MUI's hidden native input and leaves
 * the real control nameless, which a screen reader reports as "combobox" and
 * nothing else. Feature 12b shipped four dropdowns in exactly that state.
 *
 * The four regions come out of the list extracted from the legacy form and are
 * never retyped here. The number is what FiaKa receives, so FFS's own form is the
 * authority on which number is which place, and feature 16c had to correct a
 * hand-written copy that disagreed.
 */
function Regionsfeld({ wert, onAendern, meldung }: RegionsfeldProps) {
  const { t } = useTranslation()

  return (
    <FormControl className="konto-anlegen__feld" error={Boolean(meldung)} required>
      <FormLabel id={labelId('regierungspraesidium')} htmlFor="regierungspraesidium">
        {t('benutzerverwaltung.felder.regierungspraesidium')}
      </FormLabel>

      <Select
        value={wert}
        onChange={(ereignis) => onAendern(ereignis.target.value)}
        displayEmpty
        labelId={labelId('regierungspraesidium')}
        SelectDisplayProps={{ id: 'regierungspraesidium' }}
        aria-invalid={meldung ? true : undefined}
        aria-describedby={meldung ? fehlerId('regierungspraesidium', true) : undefined}
      >
        <MenuItem value="">{t('protokoll.felder.bitteWaehlen')}</MenuItem>
        {optionen('z.rp').map((option) => (
          <MenuItem key={option.wert} value={option.wert}>
            {option.label}
          </MenuItem>
        ))}
      </Select>

      {meldung && (
        <FormHelperText id={fehlerId('regierungspraesidium', true)} role="alert">
          {meldung}
        </FormHelperText>
      )}
    </FormControl>
  )
}

export default Regionsfeld
