import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import Statusabzeichen from '../Statusabzeichen'
import type { ParseKeys } from 'i18next'
import type { Status, Uebersicht } from '../entwurf/typen'
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

/* What there is to do with a protocol in each state, as a key out of de.json.
 *
 * A record keyed by Status rather than a chain of conditions, so a state added
 * later is a build error here instead of a row that silently loses its link.
 * Three words for seven states: carry on with a draft, revise one that has come
 * back, and read any of the rest. */
const AKTION: Record<Status, ParseKeys> = {
  DRAFT: 'protokolle.list.weiter',
  NEEDS_CHANGES: 'protokolle.list.ueberarbeiten',
  SUBMITTED: 'protokolle.list.ansehen',
  IN_REVIEW: 'protokolle.list.ansehen',
  REJECTED: 'protokolle.list.ansehen',
  ACCEPTED: 'protokolle.list.ansehen',
  LOCKED: 'protokolle.list.ansehen',
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
        {/* Every protocol has somewhere to go, since feature 11e.
         *
         * Until then only a draft and one sent back for correction carried a
         * link, and everything else was a badge and a dead end: somebody who
         * filed a protocol in July could not reach it from the one screen that
         * lists their protocols. 11e built the page that shows it and this is
         * what lets anybody arrive at it, which is what the note left here in
         * feature 11d asked for.
         *
         * The same address for all three. What opens there is decided by the
         * status, not by the link: a draft and a returned protocol open in the
         * form, and everything else opens read-only. */}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button
            component={Link}
            to={abschnittPfad(zeile.id, 1)}
            size="small"
            variant="outlined"
          >
            {t(AKTION[zeile.status])}
          </Button>
          {/* Text rather than outlined, so the two buttons in a row do not
              read as equally likely things to do, and red because this one
              cannot be taken back. The dialog is what actually guards it.

              Only a draft. A protocol FFS has seen cannot be deleted, which
              pruefe_loeschbar on the server refuses, so offering a button that
              could only fail would be worse than offering none. */}
          {zeile.status === 'DRAFT' && (
            <Button size="small" color="error" onClick={() => onLoeschen(zeile)}>
              {t('protokolle.list.loeschen.aktion')}
            </Button>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  )
}

export default ProtokollZeile
