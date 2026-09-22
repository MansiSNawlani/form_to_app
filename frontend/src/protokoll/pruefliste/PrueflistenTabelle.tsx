import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useTranslation } from 'react-i18next'
import type { Prueflistenabfrage } from './parameter'
import PrueflistenZeile from './PrueflistenZeile'
import type { Pruefzeile } from './typen'

/* The queue's seven columns.
 *
 * The look is not here. tabelle--liste in theme/muiTheme.ts carries it, written
 * in feature 3c for exactly this moment: the second list to be built inherits the
 * table by adding the class rather than by importing Meine Protokolle's table or
 * restating its styles. Feature 16's user list will be the third.
 */
function PrueflistenTabelle({
  zeilen,
  abfrage,
}: {
  zeilen: readonly Pruefzeile[]
  /* Handed down rather than read from the address here, so twenty-five rows
     share one reading of the query string and cannot disagree about it. */
  abfrage: Prueflistenabfrage
}) {
  const { t } = useTranslation()

  return (
    <TableContainer className="tabelle--liste">
      <Table>
        {/* The table's accessible name. A caption rather than aria-label, so it
            is announced by every screen reader and stays in the locale file with
            every other string. */}
        <caption className="visually-hidden">{t('pruefliste.tabelle.beschriftung')}</caption>
        <TableHead>
          <TableRow>
            <TableCell>{t('pruefliste.tabelle.gewaesser')}</TableCell>
            <TableCell>{t('pruefliste.tabelle.datum')}</TableCell>
            <TableCell>{t('pruefliste.tabelle.anlass')}</TableCell>
            <TableCell>{t('pruefliste.tabelle.bearbeiter')}</TableCell>
            <TableCell>{t('pruefliste.tabelle.status')}</TableCell>
            <TableCell>{t('pruefliste.tabelle.eingereicht')}</TableCell>
            {/* For screen readers only: sighted readers have the buttons
                themselves, and a printed "Aktion" over a column of buttons is
                noise. */}
            <TableCell>
              <span className="visually-hidden">{t('pruefliste.tabelle.aktion')}</span>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {zeilen.map((zeile) => (
            <PrueflistenZeile key={zeile.id} zeile={zeile} abfrage={abfrage} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default PrueflistenTabelle
