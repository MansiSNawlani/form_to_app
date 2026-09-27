import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ROLLEN, type Rolle } from '../../api/typen'

/* What the account may do, as six checkboxes.
 *
 * **All six, INTEGRATION included.** Leaving one out would mean the command line
 * stays necessary for that role, which is the dependency this whole feature exists
 * to remove.
 *
 * **In ROLLEN order**, the same order auth/rollen.ts prints them in on the account
 * list and in the header, so the roles somebody ticks read in the order they are
 * shown back afterwards.
 *
 * **No rule about which may be held together.** The backend has none, and a rule
 * invented here would be a second opinion in the browser about something the
 * server does not check. Two of the six carry a hint instead, because what they
 * mean is not inferable from their label.
 */

/* The two that need saying out loud.
 *
 * REGIERUNGSPRAESIDIUM because ticking it is a statement about which region an
 * account may see, and because it is the one that then demands a number.
 * INTEGRATION because an account holding it is refused at sign-in by melde_an,
 * and an administrator ticking it for a person has made a mistake the screen can
 * prevent rather than let them discover when that person cannot sign in.
 */
const HINWEISE: Partial<Record<Rolle, ParseKeys>> = {
  REGIERUNGSPRAESIDIUM: 'benutzerverwaltung.anlegen.rollenHinweis.REGIERUNGSPRAESIDIUM',
  INTEGRATION: 'benutzerverwaltung.anlegen.rollenHinweis.INTEGRATION',
}

interface RollenauswahlProps {
  gewaehlt: readonly Rolle[]
  onAendern: (rollen: Rolle[]) => void
  meldung?: string
}

function Rollenauswahl({ gewaehlt, onAendern, meldung }: RollenauswahlProps) {
  const { t } = useTranslation()

  /* Rebuilt from ROLLEN rather than appended to, so the chosen roles stay in the
     declared order however the administrator clicked through them. */
  const umschalten = (rolle: Rolle) => {
    const naechste = gewaehlt.includes(rolle)
      ? gewaehlt.filter((vorhanden) => vorhanden !== rolle)
      : [...gewaehlt, rolle]

    onAendern(ROLLEN.filter((kandidat) => naechste.includes(kandidat)))
  }

  return (
    /* A FormControl with a FormLabel as its legend, so the six boxes are announced
       as one named group rather than as six unrelated questions. */
    <FormControl
      component="fieldset"
      error={Boolean(meldung)}
      className="konto-anlegen__rollen"
      aria-describedby={meldung ? 'rollen-fehler' : undefined}
    >
      <FormLabel component="legend">{t('benutzerverwaltung.anlegen.rollen')}</FormLabel>

      <FormGroup>
        {ROLLEN.map((rolle) => {
          const hinweis = HINWEISE[rolle]

          return (
            <div key={rolle} className="konto-anlegen__rolle">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={gewaehlt.includes(rolle)}
                    onChange={() => umschalten(rolle)}
                    slotProps={{
                      input: {
                        'aria-describedby': hinweis ? `rolle-${rolle}-hinweis` : undefined,
                      },
                    }}
                  />
                }
                label={t(`common.rollen.${rolle}` satisfies ParseKeys)}
              />
              {hinweis && (
                <FormHelperText id={`rolle-${rolle}-hinweis`} className="konto-anlegen__hinweis">
                  {t(hinweis)}
                </FormHelperText>
              )}
            </div>
          )
        })}
      </FormGroup>

      {meldung && (
        <FormHelperText id="rollen-fehler" role="alert">
          {meldung}
        </FormHelperText>
      )}
    </FormControl>
  )
}

export default Rollenauswahl
