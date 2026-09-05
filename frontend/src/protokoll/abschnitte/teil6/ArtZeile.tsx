import Button from '@mui/material/Button'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import ArtZelle from './ArtZelle'
import ZahlZelle from './ZahlZelle'
import Zeilensumme from './Zeilensumme'
import { KLASSEN, artPfad } from './tabelle'
import type { Artnummer } from '../../entwurf/typen'

/* One catch row: a species and its twelve numbers.
 *
 * Every cell carries its own aria-label naming both its row and its column,
 * built here rather than inside the cell components. Header association alone is
 * uneven across screen readers, and at 312 controls the cost of it failing is a
 * grid of identical unnamed number boxes.
 *
 * The row number is a th scope="row", so a screen reader reading across the row
 * announces which species row it is in. TableCell renders a td by default and
 * only sets scope="col" for itself inside a TableHead, so both are asked for
 * here.
 *
 * Memoised, which coding-standards.md allows only on a measurement. Here is the
 * measurement: the table re-renders whenever a row is added or removed, and
 * without this that re-renders 26 Autocompletes over a 123 entry list. The props
 * are a number and a stable callback, so the comparison is free.
 */

interface ArtZeileProps {
  nr: Artnummer
  onEntfernen: (nr: Artnummer) => void
}

function ArtZeile({ nr, onEntfernen }: ArtZeileProps) {
  const { t } = useTranslation()
  const entfernenText = t('protokoll.abschnitt6.zeile.entfernen', { nr })

  return (
    <TableRow>
      <TableCell component="th" scope="row" className="arten-tabelle__nr">
        {nr}
      </TableCell>
      <TableCell className="arten-tabelle__art">
        <ArtZelle
          name={artPfad(nr, 'name')}
          bezeichnung={t('protokoll.abschnitt6.zeile.art', { nr })}
        />
      </TableCell>
      {KLASSEN.map(({ feld, nameKey }) => (
        <TableCell key={feld}>
          <ZahlZelle
            name={artPfad(nr, feld)}
            bezeichnung={t('protokoll.abschnitt6.zeile.feld', {
              nr,
              spalte: t(nameKey),
            })}
          />
        </TableCell>
      ))}
      <TableCell className="arten-tabelle__summe">
        <Zeilensumme nr={nr} />
      </TableCell>
      <TableCell>
        <ZahlZelle
          name={artPfad(nr, '0plus')}
          bezeichnung={t('protokoll.abschnitt6.zeile.feld', {
            nr,
            spalte: t('protokoll.abschnitt6.spalte.nullPlusName'),
          })}
        />
      </TableCell>
      <TableCell className="arten-tabelle__aktion">
        {/* A symbol, because thirteen columns leave no room for the word, and
            the words are still there for everyone: a screen reader reads the
            aria-label, a pointer gets the title. Both name the row, so
            twenty-six remove buttons are not twenty-six identical
            announcements. */}
        <Button
          type="button"
          size="small"
          onClick={() => onEntfernen(nr)}
          aria-label={entfernenText}
          title={entfernenText}
        >
          <span aria-hidden="true">✕</span>
        </Button>
      </TableCell>
    </TableRow>
  )
}

export default memo(ArtZeile)
