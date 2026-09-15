import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { fangzeilen, type Fangzeile } from './artenzeilen'
import { KLASSEN } from '../abschnitte/teil6/tabelle'
import { summeAusWerten } from '../regeln/arten'
import { optionLabel } from '../optionen'
import type { Antworten } from '../entwurf/typen'

/* A count, or a dash where none was given.
 *
 * A dash rather than the "Nicht angegeben" the ordinary fields use, and rather
 * than a zero. Forty empty cells each saying "Nicht angegeben" would drown the
 * numbers between them, and a zero is a different answer: nought of that size
 * class were caught is a claim the surveyor made, an empty cell is one they did
 * not. The two must not print alike, so a zero prints as 0 and a gap prints as
 * something nobody could read as a number.
 */
function Zahl({ wert }: { wert: string | undefined }) {
  const text = (wert ?? '').trim()
  if (text === '') return <span aria-hidden="true">-</span>
  return <>{text}</>
}

function Fang({ zeile }: { zeile: Fangzeile }) {
  const { t } = useTranslation()

  /* The ten classes only. The printed form heads the 0+ column "davon", so those
     individuals are already counted among the ten beside them and adding them in
     would count them twice. teil6/tabelle.ts says the same where the two lists
     are declared. */
  const summe = summeAusWerten(zeile.klassen)
  const beschriftung = optionLabel('arten', zeile.code)

  return (
    <TableRow>
      <TableCell component="th" scope="row" className="arten-tabelle__nr">
        {zeile.nr}
      </TableCell>
      <TableCell className="arten-tabelle__art">
        {beschriftung === null ? (
          /* Counts with no species against them. Feature 9b refuses this at
             submit, so it reaches a reviewer only through feature 23's imports
             out of the legacy form, which has no such rule. Saying so plainly is
             the point: this is very often why a protocol goes back. */
          <span className="readonly-value--leer">{t('protokoll.nurlesen.leer')}</span>
        ) : (
          <>
            <span className="cell-title">{beschriftung}</span>
            {/* The code under the name, as the mockup prints it. A reviewer
                checking this against a paper form or against FiaKa reads the
                code, not the German label. */}
            {zeile.code !== undefined && <span className="cell-sub">{zeile.code}</span>}
          </>
        )}
      </TableCell>
      {zeile.klassen.map((wert, spalte) => (
        <TableCell key={KLASSEN[spalte].feld}>
          <Zahl wert={wert} />
        </TableCell>
      ))}
      <TableCell className="arten-tabelle__summe cell-title">
        {summe === undefined ? t('protokoll.abschnitt6.tabelle.summeUnbekannt') : summe}
      </TableCell>
      <TableCell>
        <Zahl wert={zeile.nullPlus} />
      </TableCell>
    </TableRow>
  )
}

/* The block around the table, shared by the table and by the sentence that
   stands in for it.

   The legend and the hint are the same two keys ArtenTabelle reads, repeated
   rather than lifted into something both tables use: the two have nothing else
   in common, so a shared wrapper would be a component whose only job is to hold
   a fieldset around one of two unrelated things. The wording cannot drift, since
   both read it out of de.json. */
function Block({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section form-section--tabelle">
      <legend>{t('protokoll.abschnitt6.tabelle.legend')}</legend>
      <p className="form-section__hint">{t('protokoll.abschnitt6.tabelle.hinweis')}</p>
      {children}
    </fieldset>
  )
}

/* The catch table as filed: the rows that hold something, and what they add up to.
 *
 * Its own component rather than a branch inside ArtenTabelle, and it is the one
 * block this feature does not render by giving the form's own controls a second
 * look. ArtenTabelle is 312 controls with rows that grow and shrink, a picker
 * over 123 entries, a live total subscribed per row and a remove button on each.
 * None of that survives having nothing to edit, and a branch threaded through it
 * would leave both jobs harder to read than either alone.
 *
 * What this must not lose is the numbers. Every count the surveyor recorded is
 * printed, including those in a row they never named a species in.
 */
function ArtenNurLesen() {
  const { t } = useTranslation()
  const { getValues } = useFormContext<Antworten>()

  const zeilen = fangzeilen(getValues('arten'))

  if (zeilen.length === 0) {
    /* Nothing at all, which feature 9b refuses at submit: a survey that caught
       nothing has to say so with one of the four "no detection" codes. So this is
       a protocol imported from the legacy form, which has no such rule, or one
       that predates ours. Either way it is a finding for the reviewer and has to
       be stated rather than shown as an empty table. */
    return (
      <Block>
        <Typography variant="body1" className="readonly-value readonly-value--leer">
          {t('protokoll.nurlesen.keineArten')}
        </Typography>
      </Block>
    )
  }

  const gesamt = summeAusWerten(zeilen.flatMap((zeile) => [...zeile.klassen]))

  return (
    <Block>
      <TableContainer>
        <Table className="arten-tabelle">
          {/* MUI has no caption component, and a table needs one: it is what
              names the table to a screen reader listing the page's tables. */}
          <caption className="visually-hidden">
            {t('protokoll.abschnitt6.tabelle.beschriftung')}
          </caption>
          <TableHead>
            <TableRow>
              <TableCell>{t('protokoll.abschnitt6.spalte.nr')}</TableCell>
              <TableCell>{t('protokoll.abschnitt6.spalte.art')}</TableCell>
              {KLASSEN.map(({ feld, kopfKey }) => (
                <TableCell key={feld}>{t(kopfKey)}</TableCell>
              ))}
              <TableCell>{t('protokoll.abschnitt6.spalte.summe')}</TableCell>
              <TableCell>{t('protokoll.abschnitt6.spalte.nullPlus')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {zeilen.map((zeile) => (
              <Fang key={zeile.nr} zeile={zeile} />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              {/* Across the row number, the species and the ten classes, so the
                  total sits under the column it totals. */}
              <TableCell component="th" scope="row" colSpan={2 + KLASSEN.length}>
                {t('protokoll.abschnitt6.tabelle.gesamt')}
              </TableCell>
              <TableCell className="arten-tabelle__summe cell-title">
                {gesamt === undefined
                  ? t('protokoll.abschnitt6.tabelle.summeUnbekannt')
                  : gesamt}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Block>
  )
}

export default ArtenNurLesen
