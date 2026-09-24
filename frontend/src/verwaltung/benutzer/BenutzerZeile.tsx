import Chip from '@mui/material/Chip'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { BenutzerAntwort } from '../../api/typen'
import { sortierteRollen } from '../../auth/rollen'
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
 * Nothing here is a link and nothing here is a button. Reading the list is 16b;
 * changing an account is 16d, and that is where this row grows an action.
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

      <TableCell>{angelegt}</TableCell>
    </TableRow>
  )
}

export default BenutzerZeile
