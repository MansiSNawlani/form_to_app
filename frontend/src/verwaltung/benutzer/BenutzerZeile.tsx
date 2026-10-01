import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { BenutzerAntwort } from '../../api/typen'
import { sortierteRollen } from '../../auth/rollen'
import { benutzerPfad } from '../../auth/startseite'
import { zeitpunktAnzeige } from '../../protokoll/liste/anzeige'
import { kontostatusSchluessel, regierungspraesidiumLabel } from './anzeige'

interface BenutzerZeileProps {
  konto: BenutzerAntwort
  /** True for the account doing the reading. Decided by the table, so all rows in
      one render agree about it and the row needs no session of its own. */
  istEigenes: boolean
}

/* One account: who it is, what it may do, and whether it works.
 *
 * The one action is at the end, added in feature 16d: reading the list is 16b, and
 * everything that changes an account happens on that account's own page rather
 * than in this row. A row is five short facts, and a role picker or a lock button
 * in a table cell would be a form with no room to say what it is doing.
 */
function BenutzerZeile({ konto, istEigenes }: BenutzerZeileProps) {
  const { t } = useTranslation()

  const rollen = sortierteRollen(konto.rollen)
  const region = regierungspraesidiumLabel(konto.regierungspraesidium)
  const angelegt = zeitpunktAnzeige(konto.created_at)

  return (
    <TableRow>
      <TableCell>
        <span className="benutzer__email">{konto.email}</span>
        {/* Marked because 16d's refusals turn on it: a Super Admin may not lock
            their own account and may not take SUPER_ADMIN off it, both being
            ways of signing yourself out with no way back. Knowing which row is
            yours before you click is worth one comparison.

            The visible tag is two letters, so the full sentence is carried for a
            screen reader rather than left to be guessed from "Sie". */}
        {istEigenes && (
          <span className="role-tag benutzer__sie">
            <span aria-hidden="true">{t('benutzerverwaltung.sie')}</span>
            <span className="visually-hidden">{t('benutzerverwaltung.sieHinweis')}</span>
          </span>
        )}
      </TableCell>

      <TableCell>
        {/* Nothing to show is reachable, though not by an account with no roles:
            both the command line and 16a's endpoints refuse an empty list. It is
            an account holding only roles this build has never heard of, which
            sortierteRollen drops. Said in words rather than left blank, because
            an empty cell in a column of tags reads as a value that failed to
            load. */}
        {rollen.length === 0 ? (
          <span className="benutzer__leer">{t('benutzerverwaltung.ohneRollen')}</span>
        ) : (
          <span className="benutzer__rollen">
            {rollen.map((rolle) => (
              <span key={rolle} className="role-tag">
                {t(`common.rollen.${rolle}` satisfies ParseKeys)}
              </span>
            ))}
          </span>
        )}
      </TableCell>

      {/* Blank for the accounts that have none, which is most of them. A dash
          would read as a value somebody entered. */}
      <TableCell>{region}</TableCell>

      {/* Active is the ordinary state and prints as plain text; locked is the
          exception and is the only one that gets a badge, so the eye goes to the
          accounts that cannot sign in rather than to a column of identical green.
          The word is printed either way, so the colour never carries the meaning
          on its own. */}
      <TableCell>
        {konto.ist_aktiv ? (
          t(kontostatusSchluessel(true))
        ) : (
          <Chip
            size="small"
            color="warning"
            label={t(kontostatusSchluessel(false))}
          />
        )}
      </TableCell>

      <TableCell className="zeile-tabular">{angelegt}</TableCell>

      {/* The row's one action, feature 16d. The same shape a protocol's row uses:
          a small outlined button that is really a link, in a cell of its own at
          the end.

          Drawn for every account including your own. What may not be done to your
          own account is two particular changes rather than the whole screen, and
          the page itself says which before either is attempted. */}
      <TableCell className="zeile-aktion">
        <Button component={Link} to={benutzerPfad(konto.id)} size="small" variant="outlined">
          {/* The address is carried for a screen reader, because twenty buttons
              all announcing themselves as "Aendern" name nothing. Visually the
              label stays two words: the row is already read left to right. */}
          <span aria-hidden="true">{t('benutzerverwaltung.aendern.knopf')}</span>
          <span className="visually-hidden">
            {t('benutzerverwaltung.aendern.knopfHinweis', { email: konto.email })}
          </span>
        </Button>
      </TableCell>
    </TableRow>
  )
}

export default BenutzerZeile
