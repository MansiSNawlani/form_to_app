import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import { optionen } from '../optionen'
import { gruppiere, type Problem } from './gruppierung'
import type { Verstoss } from '../../api/typen'

interface AbsendeProblemeProps {
  entwurfId: string
  verstoesse: readonly Verstoss[]
  /* The species codes actually in the catch table, by row, so a refused cell can
     be named by its fish rather than by its row number. */
  artnamen: Record<number, string | undefined>
}

/* What is still missing or wrong, and where to go and fix it.
 *
 * Grouped by section, in section order, because that is the order somebody walks
 * the protocol. Each entry links to its own field: the anchor is the path,
 * unchanged, because every control on this form already carries its path as its
 * DOM id.
 *
 * The message comes out of the same protokoll.regeln keys the form itself uses
 * beside a field while somebody types. One wording, in one place, whether a rule
 * fires in the browser or at the server.
 */
function AbsendeProbleme({ entwurfId, verstoesse, artnamen }: AbsendeProblemeProps) {
  const { t, i18n } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)

  /* The message key arrives from the server as a plain string, so it is checked
     before it is translated. A backend deployed ahead of the browser can name a
     rule this locale file has never heard of, and printing the raw key at a
     surveyor is exactly what feature 11a's step 10 test exists to prevent. */
  const meldung = (schluessel: string): string =>
    i18n.exists(schluessel)
      ? t(schluessel as ParseKeys)
      : t('protokoll.absenden.probleme.unbekannteRegel')

  const { gruppen, unverortet, anzahl } = gruppiere(verstoesse)

  /* Focus moves here when the panel appears. Without it somebody pressing
     Absenden with the keyboard is left on a button whose page has silently grown
     a list above it, and a screen reader says nothing at all. */
  useEffect(() => {
    if (anzahl > 0) panel.current?.focus()
  }, [anzahl])

  if (anzahl === 0) return null

  return (
    <Alert
      severity="warning"
      ref={panel}
      tabIndex={-1}
      className="absende-probleme"
      /* Not role="alert". Thirty entries read out the moment they appear is not
         help; the heading takes focus instead, so the list is announced as the
         thing the person has just arrived in and can be read at their pace. */
    >
      <AlertTitle>{t('protokoll.absenden.probleme.titel')}</AlertTitle>
      <Typography variant="body2">
        {t('protokoll.absenden.probleme.einleitung', { count: anzahl })}
      </Typography>

      {gruppen.map((gruppe) => (
        <section key={gruppe.nr}>
          <Typography variant="subtitle2" component="h3" className="absende-probleme__abschnitt">
            {t('protokoll.absenden.probleme.abschnitt', {
              nr: gruppe.nr,
              titel: t(gruppe.titelKey),
            })}
          </Typography>
          <List dense disablePadding>
            {gruppe.probleme.map((problem) => (
              <ListItem key={problem.pfad} disableGutters>
                <Link
                  component={RouterLink}
                  to={`${abschnittPfad(entwurfId, gruppe.nr)}#${problem.pfad}`}
                >
                  {benenne(problem, artnamen, t)}
                </Link>
                {': '}
                {meldung(problem.schluessel)}
              </ListItem>
            ))}
          </List>
        </section>
      ))}

      {unverortet.length > 0 && (
        <List dense disablePadding>
          {unverortet.map((problem) => (
            <ListItem key={problem.pfad} disableGutters>
              {meldung(problem.schluessel)} {t('protokoll.absenden.probleme.ohneOrt')}
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="body2">
        {t('protokoll.absenden.probleme.entwurfBleibt')}
      </Typography>
    </Alert>
  )
}

/* What to call the field this problem is about.
 *
 * A catch cell has no label of its own, because 312 of them share twelve column
 * headings. It is named by the species standing in its row, which is the only
 * name that means anything to the person looking at it; a row with no species
 * picked yet falls back to its number.
 */
function benenne(
  problem: Problem,
  artnamen: Record<number, string | undefined>,
  t: (schluessel: ParseKeys, werte?: Record<string, unknown>) => string,
): string {
  if (problem.labelKey !== null) return t(problem.labelKey)

  if (problem.artnummer !== null) {
    const code = artnamen[problem.artnummer]
    const art = code === undefined ? undefined : optionen('arten').find((o) => o.wert === code)
    return (
      art?.label ??
      t('protokoll.absenden.probleme.artZeile', { nr: problem.artnummer })
    )
  }

  /* Unreachable as the rules stand: verorte only withholds a label for a catch
     cell, which the branch above names. Kept as a last resort rather than an
     assertion, because a rule added to the backend could reach it, and a path is
     at least something to quote when reporting the gap. */
  return problem.pfad
}

export default AbsendeProbleme
