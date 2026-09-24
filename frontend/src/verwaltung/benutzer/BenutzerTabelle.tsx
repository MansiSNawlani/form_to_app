import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useTranslation } from 'react-i18next'
import type { BenutzerAntwort } from '../../api/typen'
import BenutzerZeile from './BenutzerZeile'

/* The account list's five columns.
 *
 * The look is not here. tabelle--liste in theme/muiTheme.ts carries it, written
 * in feature 3c and inherited by the review queue in 12b: the third list in this
 * application gets the table by adding the class rather than by importing either
 * of the other two or restating their styles.
 */
function BenutzerTabelle({
  konten,
  eigeneId,
}: {
  konten: readonly BenutzerAntwort[]
  /* Handed down rather than read from the session here, so every row in one
     render agrees about whose account is whose. */
  eigeneId: string | null
}) {
  const { t } = useTranslation()

  return (
    <TableContainer className="tabelle--liste">
      <Table>
        {/* The table's accessible name. A caption rather than aria-label, so it is
            announced by every screen reader and stays in the locale file with
            every other string. The one native element on this screen, because MUI
            has no equivalent. */}
        <caption className="visually-hidden">{t('benutzerverwaltung.tabelle.beschriftung')}</caption>
        <TableHead>
          <TableRow>
            <TableCell>{t('benutzerverwaltung.tabelle.email')}</TableCell>
            <TableCell>{t('benutzerverwaltung.tabelle.rollen')}</TableCell>
            <TableCell>{t('benutzerverwaltung.tabelle.regierungspraesidium')}</TableCell>
            <TableCell>{t('benutzerverwaltung.tabelle.status')}</TableCell>
            <TableCell>{t('benutzerverwaltung.tabelle.angelegt')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {konten.map((konto) => (
            <BenutzerZeile key={konto.id} konto={konto} istEigenes={konto.id === eigeneId} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default BenutzerTabelle
