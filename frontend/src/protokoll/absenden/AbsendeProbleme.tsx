import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useEffect, useMemo, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { abschnittPfad } from '../abschnitte'
import { optionen } from '../optionen'
import { gruppiere, type Problem } from './gruppierung'
import type { Antworten } from '../entwurf/typen'
import type { Verstoss } from '../../api/typen'

interface AbsendeProblemeProps {
  entwurfId: string
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
 * **Rendered above the section rather than inside one**, which is not cosmetic.
 * Every entry here is a link whose job is to send somebody to another part of the
 * protocol, and until 2026-09-12 this panel lived at the foot of section 7, so
 * following any one of its links unmounted it: the surveyor fixed one field, came
 * back, and the list of the other forty-six was gone. A list that cannot survive
 * the trip it invites is no list at all. It now sits beside the save indicator and
 * the restore offer, which are above the section for the same reason.
 *
 * Grouped by section, in section order, because that is the order somebody walks
 * the protocol. The anchor is the path, unchanged, because every control on this
 * form already carries its path as its DOM id.
 *
 * The message comes out of the same protokoll.regeln keys the form itself uses
 * beside a field while somebody types. One wording, in one place, whether a rule
 * fires in the browser or at the server.
 */
function AbsendeProbleme({
  entwurfId,
  verstoesse,
  artnamen,
  onErneutPruefen,
  laeuft,
  onSchliessen,
}: AbsendeProblemeProps) {
  const { t, i18n } = useTranslation()
  const { control } = useFormContext<Antworten>()
  const panel = useRef<HTMLDivElement>(null)

  /* The message key arrives from the server as a plain string, so it is checked
     before it is translated. A backend deployed ahead of the browser can name a
     rule this locale file has never heard of, and printing the raw key at a
     surveyor is exactly what feature 11a's step 10 test exists to prevent. */
  const meldung = (schluessel: string): string =>
    i18n.exists(schluessel)
      ? t(schluessel as ParseKeys)
      : t('protokoll.absenden.probleme.unbekannteRegel')

  /* Only the paths that name a real field.
   *
   * Watched by name rather than through a bare watch(), which would subscribe
   * this panel to all 338 answers and redraw forty-seven list entries on every
   * keystroke anywhere in the protocol. On the catch table that is the 206ms
   * re-render useAutoSave's own comment records. */
  const feldpfade = useMemo(
    () => verstoesse.map((verstoss) => verstoss.pfad).filter((pfad) => !istSammelpfad(pfad)),
    [verstoesse],
  )

  const werte = useWatch({ control, name: feldpfade as never })

  const erledigt = useMemo(() => {
    const gefuellt = new Set<string>()
    const gelesen: unknown[] = Array.isArray(werte) ? werte : []
    feldpfade.forEach((pfad, index) => {
      const wert = gelesen[index]
      if (typeof wert === 'string' && wert.trim() !== '') gefuellt.add(pfad)
    })
    return gefuellt
  }, [feldpfade, werte])

  const { gruppen, unverortet, anzahl, offen } = gruppiere(verstoesse, erledigt)

  /* Focus moves here when a refusal arrives, and only then. Without it somebody
     pressing Absenden with the keyboard is left on a button whose page has
     silently grown a list above it, and a screen reader says nothing at all.
     Keyed on the number of problems rather than on every render, so typing into a
     field does not pull focus out of the field being typed into. */
  useEffect(() => {
    if (anzahl > 0) panel.current?.focus()
  }, [anzahl])

  if (anzahl === 0) return null

  return (
    <Alert severity="warning" ref={panel} tabIndex={-1} className="absende-probleme">
      <AlertTitle>{t('protokoll.absenden.probleme.titel')}</AlertTitle>
      <Typography variant="body2">
        {offen === 0
          ? t('protokoll.absenden.probleme.alleBearbeitet')
          : t('protokoll.absenden.probleme.einleitung', { count: offen })}
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
              <ListItem
                key={problem.pfad}
                disableGutters
                className={problem.erledigt ? 'absende-probleme__erledigt' : undefined}
              >
                <Link
                  component={RouterLink}
                  to={`${abschnittPfad(entwurfId, gruppe.nr)}#${problem.pfad}`}
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

      <Typography variant="body2">{t('protokoll.absenden.probleme.entwurfBleibt')}</Typography>

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

/* Problems that name a block rather than a field: a percentage run, a tick group,
 * a fished area, the catch table as a whole. None can be ticked off by looking at
 * one box, so they stay listed until a fresh check answers them. */
function istSammelpfad(pfad: string): boolean {
  return (
    pfad.startsWith('summe.') ||
    pfad.startsWith('block.') ||
    pfad.startsWith('bereich.') ||
    pfad.startsWith('widerspruch.') ||
    pfad.startsWith('paar.') ||
    pfad.startsWith('tabelle.')
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
    return art?.label ?? t('protokoll.absenden.probleme.artZeile', { nr: problem.artnummer })
  }

  /* Unreachable as the rules stand: verorte only withholds a label for a catch
     cell, which the branch above names. Kept as a last resort rather than an
     assertion, because a rule added to the backend could reach it, and a path is
     at least something to quote when reporting the gap. */
  return problem.pfad
}

export default AbsendeProbleme
