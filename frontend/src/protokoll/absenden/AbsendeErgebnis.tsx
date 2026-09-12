import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useFormContext } from 'react-hook-form'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useFehlertext } from '../../api/useFehlertext'
import type { Antworten } from '../entwurf/typen'
import AbsendeProbleme from './AbsendeProbleme'
import { NichtGespeichert, type Absenden } from './useAbsenden'

interface AbsendeErgebnisProps {
  entwurfId: string
  /** Which section is open, so the panel lists only that one's problems. */
  aktuelleNr: number
  absendung: Absenden
}

/* Whatever the last attempt to submit came back with.
 *
 * One component for the three outcomes, because only ever one of them applies
 * and a reader looking for "what happens after Absenden" should find them
 * together rather than scattered.
 *
 * Rendered above the open section. The panel inside it is a list of links to
 * other sections, so anything holding it has to outlive the trip it invites.
 */
function AbsendeErgebnis({ entwurfId, aktuelleNr, absendung }: AbsendeErgebnisProps) {
  const { t } = useTranslation()
  const { getValues } = useFormContext<Antworten>()
  const { verstoesse, fehler, bereitsAbgesendet, absenden, verwerfen, laeuft } = absendung

  const fehlertext = useFehlertext(fehler)
  const istUngespeichert = fehler instanceof NichtGespeichert

  /* Pressed twice, or the first answer was lost on the way back. Nothing went
     wrong for the person, so this reads as good news with the way onward rather
     than as a conflict they have to do something about. */
  if (bereitsAbgesendet) {
    return (
      <Alert
        severity="success"
        action={
          <Button component={Link} to="/protokolle" size="small" color="inherit">
            {t('protokoll.absenden.bereitsAbgesendet.zurUebersicht')}
          </Button>
        }
      >
        {t('protokoll.absenden.bereitsAbgesendet.text')}
      </Alert>
    )
  }

  if (fehler !== null) {
    return (
      <Alert severity="error" onClose={verwerfen}>
        {istUngespeichert ? t('protokoll.absenden.nichtGespeichert') : fehlertext}
      </Alert>
    )
  }

  return (
    <AbsendeProbleme
      entwurfId={entwurfId}
      aktuelleNr={aktuelleNr}
      verstoesse={verstoesse}
      /* Read once per render rather than watched. The panel watches the paths it
         actually lists, which is what keeps a keystroke from redrawing it; the
         species names only matter for rows already in the list. */
      artnamen={artnamenAus(getValues())}
      onErneutPruefen={absenden}
      laeuft={laeuft}
      onSchliessen={verwerfen}
    />
  )
}

/* The species code in each catch row, keyed by row number.
 *
 * Only the code. Turning it into a German name is the panel's job, since that
 * needs the option list and this needs none of it.
 */
function artnamenAus(antworten: Antworten): Record<number, string | undefined> {
  const arten = antworten.arten
  if (arten === undefined) return {}

  const namen: Record<number, string | undefined> = {}
  for (const [schluessel, zeile] of Object.entries(arten)) {
    const nr = Number(schluessel.replace('art', ''))
    if (Number.isInteger(nr)) namen[nr] = zeile?.name
  }
  return namen
}

export default AbsendeErgebnis
