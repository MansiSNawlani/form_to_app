import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { optionen } from '../optionen'
import {
  PRUEFSTATUS,
  SORTIERUNGEN,
  type Aenderung,
  type Prueflistenabfrage,
  type Sortierung,
  type Statuswahl,
} from './parameter'

/* How long to wait after the last keystroke before the address bar changes.
 *
 * Long enough that typing a water name is one request rather than eight, short
 * enough that the list feels like it is following along. The wait is also what
 * keeps the browser history usable: without it, Back would walk letter by letter
 * back through a search term. */
const TIPPPAUSE = 350

/* The years the dropdown offers: this one and the nine before it.
 *
 * The endpoint takes any year and offers no list of which ones have protocols in
 * them, and asking for one would be a second endpoint built for a dropdown. Ten
 * covers everything this application will hold for a decade. Older protocols can
 * only arrive through feature 23's import of the paper backlog, and those are
 * still findable by search; a hand-typed jahr= in the address still works for any
 * year, because parameter.ts accepts what the endpoint accepts.
 */
const JAHRE_ZURUECK = 10

function jahre(heute: Date): number[] {
  const jetzt = heute.getFullYear()
  return Array.from({ length: JAHRE_ZURUECK }, (_, versatz) => jetzt - versatz)
}

interface FilterleisteProps {
  abfrage: Prueflistenabfrage
  onAendern: (aenderung: Aenderung) => void
}

/* The five controls that decide what the queue shows.
 *
 * None of them holds any state. Each reads its value out of the selection the
 * page took from the address bar and reports a change back up, where it is
 * written to the address bar again. The search box is the single exception, and
 * only for what has been typed but not yet acted on.
 */
function Filterleiste({ abfrage, onAendern }: FilterleisteProps) {
  const { t } = useTranslation()

  /* The one piece of local state on this screen, and it is a typing convenience
     rather than list state. Writing every keystroke straight to the address bar
     would fire a request per letter and fill the history with them. */
  const [suchtext, setSuchtext] = useState(abfrage.suche)

  /* Somebody else changed the search: the reset button, the Back button, or a
     link that was pasted in. The box follows the address bar, which is the
     authority on what is being searched for.

     Adjusted during render rather than in an effect, which is what React asks for
     when state has to follow a prop: an effect would render the stale value once,
     then immediately render again, and the box would visibly flicker back to what
     was typed before the reset took. */
  const [geseheneSuche, setGeseheneSuche] = useState(abfrage.suche)
  if (abfrage.suche !== geseheneSuche) {
    setGeseheneSuche(abfrage.suche)
    setSuchtext(abfrage.suche)
  }

  useEffect(() => {
    if (suchtext === abfrage.suche) return

    const zeitgeber = setTimeout(() => onAendern({ suche: suchtext }), TIPPPAUSE)
    return () => clearTimeout(zeitgeber)
  }, [suchtext, abfrage.suche, onAendern])

  return (
    <div className="filters" role="search" aria-label={t('pruefliste.filter.beschriftung')}>
      <FormControl className="filters__feld">
        <FormLabel htmlFor="pruefliste-suche">{t('pruefliste.filter.suche')}</FormLabel>
        <OutlinedInput
          id="pruefliste-suche"
          type="search"
          value={suchtext}
          placeholder={t('pruefliste.filter.suchePlatzhalter')}
          onChange={(ereignis) => setSuchtext(ereignis.target.value)}
        />
      </FormControl>

      <FormControl className="filters__feld">
        <FormLabel htmlFor="pruefliste-status">{t('pruefliste.filter.status')}</FormLabel>
        <Select
          id="pruefliste-status"
          value={abfrage.status}
          onChange={(ereignis) => onAendern({ status: ereignis.target.value as Statuswahl })}
        >
          {/* The default, and a named entry rather than a quiet narrowing. A
              queue that hides the decided protocols without saying so reads as a
              database with rows missing from it. */}
          <MenuItem value="offen">{t('pruefliste.filter.statusOffen')}</MenuItem>
          <MenuItem value="alle">{t('pruefliste.filter.statusAlle')}</MenuItem>
          {PRUEFSTATUS.map((zustand) => (
            <MenuItem key={zustand} value={zustand}>
              {t(`protokolle.list.status.${zustand}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl className="filters__feld">
        <FormLabel htmlFor="pruefliste-jahr">{t('pruefliste.filter.jahr')}</FormLabel>
        <Select
          id="pruefliste-jahr"
          value={abfrage.jahr === null ? '' : String(abfrage.jahr)}
          onChange={(ereignis) =>
            onAendern({ jahr: ereignis.target.value === '' ? null : Number(ereignis.target.value) })
          }
        >
          <MenuItem value="">{t('pruefliste.filter.jahrAlle')}</MenuItem>
          {jahre(new Date()).map((jahr) => (
            <MenuItem key={jahr} value={String(jahr)}>
              {jahr}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl className="filters__feld">
        <FormLabel htmlFor="pruefliste-anlass">{t('pruefliste.filter.anlass')}</FormLabel>
        <Select
          id="pruefliste-anlass"
          value={abfrage.anlass ?? ''}
          onChange={(ereignis) =>
            onAendern({ anlass: ereignis.target.value === '' ? null : ereignis.target.value })
          }
        >
          <MenuItem value="">{t('pruefliste.filter.anlassAlle')}</MenuItem>
          {/* The form's own list, so the queue and the form cannot disagree about
              what an occasion is called. */}
          {optionen('anlass').map((option) => (
            <MenuItem key={option.wert} value={option.wert}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl className="filters__feld">
        <FormLabel htmlFor="pruefliste-sortierung">
          {t('pruefliste.filter.sortierung')}
        </FormLabel>
        <Select
          id="pruefliste-sortierung"
          value={abfrage.sortierung}
          onChange={(ereignis) =>
            onAendern({ sortierung: ereignis.target.value as Sortierung })
          }
        >
          {/* Exactly the four the endpoint has, and no invented directions. A
              control offering an order the server has not got is a sort that
              silently does nothing. */}
          {SORTIERUNGEN.map((sortierung) => (
            <MenuItem key={sortierung} value={sortierung}>
              {t(`pruefliste.sortierungen.${sortierung}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  )
}

export default Filterleiste
