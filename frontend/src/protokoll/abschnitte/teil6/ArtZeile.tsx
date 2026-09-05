import Button from '@mui/material/Button'
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
    <tr>
      <th scope="row" className="arten-tabelle__nr">
        {nr}
      </th>
      <td className="arten-tabelle__art">
        <ArtZelle
          name={artPfad(nr, 'name')}
          bezeichnung={t('protokoll.abschnitt6.zeile.art', { nr })}
        />
      </td>
      {KLASSEN.map(({ feld, nameKey }) => (
        <td key={feld}>
          <ZahlZelle
            name={artPfad(nr, feld)}
            bezeichnung={t('protokoll.abschnitt6.zeile.feld', {
              nr,
              spalte: t(nameKey),
            })}
          />
        </td>
      ))}
      <td className="arten-tabelle__summe">
        <Zeilensumme nr={nr} />
      </td>
      <td>
        <ZahlZelle
          name={artPfad(nr, '0plus')}
          bezeichnung={t('protokoll.abschnitt6.zeile.feld', {
            nr,
            spalte: t('protokoll.abschnitt6.spalte.nullPlusName'),
          })}
        />
      </td>
      <td className="arten-tabelle__aktion">
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
      </td>
    </tr>
  )
}

export default memo(ArtZeile)
