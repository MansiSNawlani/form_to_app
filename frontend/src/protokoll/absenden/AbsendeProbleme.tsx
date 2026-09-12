import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'
import type { ParseKeys } from 'i18next'
import { useEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import { optionen } from '../optionen'
import { gruppiere, type Problem } from './gruppierung'
import { useErledigtePfade } from './useErledigte'
import type { Verstoss } from '../../api/typen'

interface AbsendeProblemeProps {
  entwurfId: string
  /* When the server said this. Printed because the list now outlives the page it
     was fetched on: after a reload it can be an hour old, and a list that does
     not admit its age invites somebody to trust it as current. */
  geprueftAm: string | null
  /** Which section is open. Only its problems are listed here. */
  aktuelleNr: number
  verstoesse: readonly Verstoss[]
  /* The species codes actually in the catch table, by row, so a refused cell can
     be named by its fish rather than by its row number. */
  artnamen: Record<number, string | undefined>
  /** Check again against the server, the only authority on correctness. */
  onErneutPruefen: () => void
  laeuft: boolean
  onSchliessen: () => void
}

/* What is still missing or wrong, and where to go and fix it.
 *
 * **Only the open section's problems**, decided with Mansi on 2026-09-12. It
 * showed all of them at the top of every section for half a day, and forty-seven
 * entries above the form turned every correction into a scroll down past the
 * other six sections and back up again. Where the rest are is the step bar's
 * question now, and it answers it with a count per section.
 *
 * It is still held above the section rather than inside it, which is what lets it
 * survive the navigation its own links invite. Before that it lived at the foot
 * of section 7, so following any link unmounted it: the surveyor fixed one field,
 * came back, and the list was gone.
 *
 * The anchor is the path, unchanged, because every control on this form already
 * carries its path as its DOM id.
 *
 * The message comes out of the same protokoll.regeln keys the form itself uses
 * beside a field while somebody types. One wording, in one place, whether a rule
 * fires in the browser or at the server.
 */
function AbsendeProbleme({
  entwurfId,
  geprueftAm,
  aktuelleNr,
  verstoesse,
  artnamen,
  onErneutPruefen,
  laeuft,
  onSchliessen,
}: AbsendeProblemeProps) {
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

  const erledigt = useErledigtePfade(verstoesse)

  const { gruppen, unverortet, anzahl, offen } = gruppiere(verstoesse, erledigt)

  /* This section's entries, and nothing else. The rest are still counted, so the
     line below can say how much is left elsewhere without listing any of it. */
  const hier = gruppen.find((gruppe) => gruppe.nr === aktuelleNr)
  const woanders = offen - (hier?.probleme.filter((problem) => !problem.erledigt).length ?? 0)

  /* Focus moves here when a refusal arrives, and only then. Without it somebody
     pressing Absenden with the keyboard is left on a button whose page has
     silently grown a list above it, and a screen reader says nothing at all.
     Keyed on the number of problems rather than on every render, so typing into a
     field does not pull focus out of the field being typed into. */
  useEffect(() => {
    if (anzahl > 0) panel.current?.focus()
  }, [anzahl])

  // Nothing wrong here and nothing unplaceable: this section says nothing at all.
  if (hier === undefined && unverortet.length === 0) return null

  return (
    <Alert severity="warning" ref={panel} tabIndex={-1} className="absende-probleme">
      <AlertTitle>{t('protokoll.absenden.probleme.titel')}</AlertTitle>
      <Typography variant="body2">
        {offen === 0
          ? t('protokoll.absenden.probleme.alleBearbeitet')
          : t('protokoll.absenden.probleme.inDiesemAbschnitt', {
              count: hier?.probleme.filter((problem) => !problem.erledigt).length ?? 0,
            })}
        {woanders > 0 && ` ${t('protokoll.absenden.probleme.woanders', { count: woanders })}`}
      </Typography>

      {hier !== undefined && (
        <section>
          <List dense disablePadding>
            {hier.probleme.map((problem) => (
              <ListItem
                key={problem.pfad}
                disableGutters
                className={problem.erledigt ? 'absende-probleme__erledigt' : undefined}
              >
                <Link
                  component={RouterLink}
                  to={`${abschnittPfad(entwurfId, aktuelleNr)}#${problem.pfad}`}
                >
                  {benenne(problem, artnamen, t)}
                </Link>
                {': '}
                {problem.erledigt
                  ? t('protokoll.absenden.probleme.ausgefuellt')
                  : meldung(problem.schluessel)}
              </ListItem>
            ))}
          </List>
        </section>
      )}

      {unverortet.length > 0 && (
        <List dense disablePadding>
          {unverortet.map((problem) => (
            <ListItem key={problem.pfad} disableGutters>
              {meldung(problem.schluessel)} {t('protokoll.absenden.probleme.ohneOrt')}
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="body2">{t('protokoll.absenden.probleme.entwurfBleibt')}</Typography>

      {geprueftAm !== null && (
        <Typography variant="body2" className="absende-probleme__stand">
          {t('protokoll.absenden.probleme.stand', { zeitpunkt: standAnzeige(geprueftAm) })}
        </Typography>
      )}

      <Stack direction="row" spacing={1} className="absende-probleme__aktionen">
        {/* The only thing that can say a protocol is right. Ticking an entry off
            above means a box is no longer empty, which is a smaller claim. */}
        <Button variant="outlined" size="small" onClick={onErneutPruefen} disabled={laeuft}>
          {laeuft
            ? t('protokoll.absenden.probleme.prueftGerade')
            : t('protokoll.absenden.probleme.erneutPruefen')}
        </Button>
        <Button size="small" onClick={onSchliessen}>
          {t('protokoll.absenden.probleme.schliessen')}
        </Button>
      </Stack>
    </Alert>
  )
}

/* When the list was fetched, written out in full rather than as "vor 20
 * Minuten": the question it answers is whether to trust the list, and a reader
 * deciding that wants the time, not an approximation of it. */
function standAnzeige(zeitpunkt: string): string {
  const moment = dayjs(zeitpunkt)
  return moment.isValid() ? moment.format('DD.MM.YYYY, HH:mm') : zeitpunkt
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
    return art?.label ?? t('protokoll.absenden.probleme.artZeile', { nr: problem.artnummer })
  }

  /* Unreachable as the rules stand: verorte only withholds a label for a catch
     cell, which the branch above names. Kept as a last resort rather than an
     assertion, because a rule added to the backend could reach it, and a path is
     at least something to quote when reporting the gap. */
  return problem.pfad
}

export default AbsendeProbleme
