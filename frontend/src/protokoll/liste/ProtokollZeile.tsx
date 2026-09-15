import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import Statusabzeichen from '../Statusabzeichen'
import type { Uebersicht } from '../entwurf/typen'
import {
  anlassLabel,
  bearbeitetAnzeige,
  datumAnzeige,
  unterzeile,
  zeilenTitel,
} from './anzeige'

interface ProtokollZeileProps {
  zeile: Uebersicht
  /** Passed in rather than read here, so every row in one render agrees on what
      "heute" means and the page can be reasoned about without a clock. */
  jetzt: Date
  /** Asks the question. The row never deletes anything itself. */
  onLoeschen: (zeile: Uebersicht) => void
}

function ProtokollZeile({ zeile, jetzt, onLoeschen }: ProtokollZeileProps) {
  const { t } = useTranslation()

  const bearbeitet = bearbeitetAnzeige(zeile.updated_at, jetzt)
  const zweiteZeile = unterzeile(zeile.ortsangabe, zeile.laenge)

  return (
    <TableRow>
      <TableCell>
        <span className="cell-title">
          {zeilenTitel(zeile) ?? t('protokolle.list.ohneGewaesser')}
        </span>
        {zweiteZeile !== null && <span className="cell-sub">{zweiteZeile}</span>}
      </TableCell>

      <TableCell className="zeile-tabular">{datumAnzeige(zeile.datum) ?? ''}</TableCell>

      <TableCell>{anlassLabel(zeile.anlass) ?? ''}</TableCell>

      <TableCell>
        <Statusabzeichen status={zeile.status} />
      </TableCell>

      <TableCell className="zeile-tabular">
        {bearbeitet === null
          ? ''
          : bearbeitet.art === 'datum'
            ? bearbeitet.datum
            : t(`protokolle.list.bearbeitet.${bearbeitet.art}`, { zeit: bearbeitet.zeit })}
      </TableCell>

      <TableCell className="zeile-aktion">
        {/* Two kinds of protocol have somewhere to go, and they are not the
            same two things to do.

            A draft can be opened and thrown away. One sent back for correction
            can only be opened: FFS has seen it, a reviewer is waiting for it,
            and deleting it would take their decisions with it, which is why
            pruefe_loeschbar on the server refuses one. Offering a button that
            can only fail would be worse than offering none.

            The remaining states still carry the badge and no action. Their
            screen is the reviewer's, which is feature 11e. */}
        {(zeile.status === 'DRAFT' || zeile.status === 'NEEDS_CHANGES') && (
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button
              component={Link}
              to={abschnittPfad(zeile.id, 1)}
              size="small"
              variant="outlined"
            >
              {t(
                zeile.status === 'NEEDS_CHANGES'
                  ? 'protokolle.list.ueberarbeiten'
                  : 'protokolle.list.weiter',
              )}
            </Button>
            {/* Text rather than outlined, so the two buttons in a row do not
                read as equally likely things to do, and red because this one
                cannot be taken back. The dialog is what actually guards it. */}
            {zeile.status === 'DRAFT' && (
              <Button size="small" color="error" onClick={() => onLoeschen(zeile)}>
                {t('protokolle.list.loeschen.aktion')}
              </Button>
            )}
          </Stack>
        )}
      </TableCell>
    </TableRow>
  )
}

export default ProtokollZeile
