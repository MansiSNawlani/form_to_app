import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useTranslation } from 'react-i18next'
import ProtokollZeile from './ProtokollZeile'
import type { Uebersicht } from '../entwurf/typen'

interface ProtokollTabelleProps {
  zeilen: readonly Uebersicht[]
  jetzt: Date
  onLoeschen: (zeile: Uebersicht) => void
}

/* The six columns of prototypes/meine-protokolle.html.
 *
 * The look is not here. tabelle--liste in theme/muiTheme.ts carries it, so
 * feature 12's review queue and feature 16's user list inherit the same table
 * by adding the class rather than by importing this or restating its styles.
 */
function ProtokollTabelle({ zeilen, jetzt, onLoeschen }: ProtokollTabelleProps) {
  const { t } = useTranslation()

  return (
    <section className="card">
      <TableContainer className="tabelle--liste">
        <Table>
          {/* The table's accessible name. A caption rather than aria-label, so
              it is announced by every screen reader and stays in the locale file
              with every other string. */}
          <caption className="visually-hidden">
            {t('protokolle.list.tabelle.beschriftung')}
          </caption>
          <TableHead>
            <TableRow>
              <TableCell>{t('protokolle.list.tabelle.gewaesser')}</TableCell>
              <TableCell>{t('protokolle.list.tabelle.datum')}</TableCell>
              <TableCell>{t('protokolle.list.tabelle.anlass')}</TableCell>
              <TableCell>{t('protokolle.list.tabelle.status')}</TableCell>
              <TableCell>{t('protokolle.list.tabelle.bearbeitet')}</TableCell>
              {/* The action column's heading is for screen readers only:
                  sighted readers have the buttons themselves, and a printed
                  "Aktion" over a column of buttons is noise. */}
              <TableCell>
                <span className="visually-hidden">{t('protokolle.list.tabelle.aktion')}</span>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {zeilen.map((zeile) => (
              <ProtokollZeile
                key={zeile.id}
                zeile={zeile}
                jetzt={jetzt}
                onLoeschen={onLoeschen}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  )
}

export default ProtokollTabelle
