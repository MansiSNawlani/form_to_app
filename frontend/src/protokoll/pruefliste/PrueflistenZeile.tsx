import Button from '@mui/material/Button'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Statusabzeichen from '../Statusabzeichen'
import { anlassLabel, datumAnzeige, zeitpunktAnzeige } from '../liste/anzeige'
import { unterzeile } from './anzeige'
import type { Pruefzeile } from './typen'

/* One handed-in protocol, as the queue lists it.
 *
 * Every value comes from a real column rather than from the answers document,
 * which is the whole payoff of feature 11b: a protocol that has left DRAFT has a
 * Probestrecke and a Gewaesser behind it, so the water and the place are joined
 * rather than parsed.
 *
 * The action is always the same one. Unlike Meine Protokolle, where what there is
 * to do depends on the state, there is exactly one thing to do with a protocol in
 * this queue: open it and read it. What is possible once there is 11f's decision
 * rail to decide, and it already refuses somebody their own protocol.
 */
function PrueflistenZeile({ zeile }: { zeile: Pruefzeile }) {
  const { t } = useTranslation()

  const monitoring =
    zeile.monitoringstrecke_nr === null
      ? null
      : t('pruefliste.tabelle.monitoringstrecke', { nummer: zeile.monitoringstrecke_nr })

  const zweiteZeile = unterzeile(zeile.ortsangabe, zeile.laenge_m, monitoring)

  return (
    <TableRow>
      <TableCell>
        <span className="cell-title">{zeile.gewaessername}</span>
        {zweiteZeile !== null && <span className="cell-sub">{zweiteZeile}</span>}
      </TableCell>

      {/* The day somebody stood in the water, not the day it was filed. A
          reviewer asking "which outing was this" means the former; the latter is
          in the Eingereicht column, labelled as such. */}
      <TableCell className="zeile-tabular">{datumAnzeige(zeile.datum) ?? ''}</TableCell>

      <TableCell>{anlassLabel(zeile.anlass) ?? zeile.anlass}</TableCell>

      {/* Who carried out the survey, which is not always the account that filed
          it. That is why Person is its own record, and why this column and the
          address under Eingereicht are two different answers. */}
      <TableCell>{zeile.bearbeiter_name}</TableCell>

      <TableCell>
        <Statusabzeichen status={zeile.status} />
      </TableCell>

      <TableCell className="zeile-tabular">
        <span className="cell-title">{zeitpunktAnzeige(zeile.submitted_at) ?? ''}</span>
        <span className="cell-sub">{zeile.eingereicht_von}</span>
      </TableCell>

      <TableCell className="zeile-aktion">
        <Button
          component={Link}
          to={`/protokolle/${zeile.id}/pruefung`}
          size="small"
          variant="outlined"
        >
          {t('pruefliste.tabelle.pruefen')}
          {/* Twenty-five buttons all reading "Pruefen" are twenty-five identical
              announcements to somebody tabbing through with a screen reader, who
              has no column of text beside them to say which is which. The water
              rides along unseen so each button says what it opens. */}
          <span className="visually-hidden">{`, ${zeile.gewaessername}`}</span>
        </Button>
      </TableCell>
    </TableRow>
  )
}

export default PrueflistenZeile
