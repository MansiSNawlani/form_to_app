import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import type { Uebersicht } from '../entwurf/typen'
import {
  anlassLabel,
  bearbeitetAnzeige,
  datumAnzeige,
  statusAnzeige,
  unterzeile,
  zeilenTitel,
  type Statusfarbe,
} from './anzeige'

/* Our token colour to MUI's palette slot. One line rather than a colour prop
   chosen per status at the call site, so the badge cannot drift from what
   anzeige.ts decided. */
const CHIP_FARBE: Record<Statusfarbe, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  neutral: 'default',
  info: 'info',
  warn: 'warning',
  danger: 'error',
  ok: 'success',
}

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

  const status = statusAnzeige(zeile.status)
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
        <Chip
          size="small"
          color={CHIP_FARBE[status.farbe]}
          label={t(status.schluessel)}
        />
      </TableCell>

      <TableCell className="zeile-tabular">
        {bearbeitet === null
          ? ''
          : bearbeitet.art === 'datum'
            ? bearbeitet.datum
            : t(`protokolle.list.bearbeitet.${bearbeitet.art}`, { zeit: bearbeitet.zeit })}
      </TableCell>

      <TableCell className="zeile-aktion">
        {/* Only a draft has anywhere to go. Nothing can leave DRAFT until
            feature 11 adds the workflow, which is also what gives the other
            states a screen to open; until then their rows carry the badge and
            no action rather than a link to a page that does not exist. */}
        {zeile.status === 'DRAFT' && (
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button
              component={Link}
              to={abschnittPfad(zeile.id, 1)}
              size="small"
              variant="outlined"
            >
              {t('protokolle.list.weiter')}
            </Button>
            {/* Text rather than outlined, so the two buttons in a row do not
                read as equally likely things to do, and red because this one
                cannot be taken back. The dialog is what actually guards it. */}
            <Button size="small" color="error" onClick={() => onLoeschen(zeile)}>
              {t('protokolle.list.loeschen.aktion')}
            </Button>
          </Stack>
        )}
      </TableCell>
    </TableRow>
  )
}

export default ProtokollZeile
