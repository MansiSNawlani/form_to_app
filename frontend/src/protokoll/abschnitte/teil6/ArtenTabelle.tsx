import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import ArtZeile from './ArtZeile'
import Gesamtsumme from './Gesamtsumme'
import NachweisMeldung from './NachweisMeldung'
import Zeilenwaechter from './Zeilenwaechter'
import Zellmeldungen from './Zellmeldungen'
import { KLASSEN, MAX_ARTEN, alleArtPfade, nachzupruefen } from './tabelle'
import { anfangsZeilen, entfernenSchreiben } from './zeilen'
import { useNachpruefung } from '../../regeln/useNachpruefung'
import type { Antworten, AntwortPfad, Artnummer } from '../../entwurf/typen'

/* Declared out here because useNachpruefung's arguments have to be stable across
   renders; an inline array resubscribes on every one. What the recheck actually
   maps to lives in tabelle.ts, where it can be tested without a form. */
const LOESEN_AUS: readonly AntwortPfad[] = alleArtPfade()

/* What was caught, by species and size.
 *
 * A real table, not a grid of divs. Thirteen columns of numbers that a surveyor
 * reads down as well as across is the case tables exist for, and the semantics
 * are what let a screen reader answer "which column am I in" at all. MUI's
 * table components render exactly those elements, and the look comes from
 * muiTheme.ts so the tables in features 12 and 16 do not have to restate it.
 *
 * TableContainer is the scroll frame: thirteen columns do not fit a narrow
 * window and will not be made to, so the table keeps its shape and scrolls
 * sideways inside it rather than stacking into cards that lose the comparison
 * down a column, which is the whole reason the data is a table.
 *
 * The row count is component state, not an answer: how many rows are open
 * describes the screen rather than the survey. zeilen.ts seeds it from the draft
 * and Zeilenwaechter grows it as the last row is used. A row somebody opened and
 * never filled is simply gone on the next visit, which is right, since it held
 * nothing.
 *
 * The seed is a useState initialiser rather than an effect, so the first render
 * already has the right number of rows and the table never flashes at one row
 * before opening the rest.
 */

function ArtenTabelle() {
  const { t } = useTranslation()
  const { getValues, setValue, trigger } = useFormContext<Antworten>()

  const [anzahl, setAnzahl] = useState(() => anfangsZeilen(getValues('arten')))

  useNachpruefung(LOESEN_AUS, nachzupruefen)

  const zeilen = Array.from({ length: anzahl }, (_, i) => (i + 1) as Artnummer)
  const voll = anzahl >= MAX_ARTEN

  const wachsen = useCallback(
    () => setAnzahl((offen) => Math.min(offen + 1, MAX_ARTEN)),
    [],
  )

  /* Stable, so the memo on ArtZeile actually holds. A fresh closure per render
     would make every row's props differ and defeat the point. */
  const entfernen = useCallback(
    (nr: Artnummer) => {
      /* A write per field, not one write of the whole group; zeilen.ts says
         why. */
      const schreibvorgaenge = entfernenSchreiben(getValues('arten'), nr)

      for (const { pfad, wert } of schreibvorgaenge) {
        setValue(pfad, wert, { shouldDirty: true })
      }

      /* Every moved cell rechecked once, after the last one has landed.
       *
       * Neither of the two mechanisms that normally keep a message honest
       * reaches this. React Hook Form validates a field when the user leaves it,
       * and nobody left these; useNachpruefung deliberately never rechecks the
       * field that changed, because while somebody is typing that field is
       * already React Hook Form's own job.
       *
       * So without this a removal leaves the messages of the row that moved
       * behind: the cells are blanked and their complaints stay on screen,
       * pointing at rows that no longer hold what they describe, until the page
       * is reloaded. Found on 2026-09-06 by removing a row that held a wrong
       * count.
       *
       * After the loop rather than inside it, and once rather than per write.
       * The row rules read a whole row and the duplicate rule reads every row,
       * so a check run halfway through the shift would judge a table that is
       * half old and half new. */
      void trigger(schreibvorgaenge.map(({ pfad }) => pfad))

      setAnzahl((offen) => Math.max(offen - 1, 1))
    },
    [getValues, setValue, trigger],
  )

  return (
    <fieldset className="form-section form-section--tabelle">
      <legend>{t('protokoll.abschnitt6.tabelle.legend')}</legend>
      <p className="form-section__hint">{t('protokoll.abschnitt6.tabelle.hinweis')}</p>

      <TableContainer>
        <Table className="arten-tabelle">
          {/* MUI has no caption component, and a table needs one: it is what
              names the table to a screen reader listing the page's tables. */}
          <caption className="visually-hidden">
            {t('protokoll.abschnitt6.tabelle.beschriftung')}
          </caption>
          <TableHead>
            <TableRow>
              <TableCell className="arten-tabelle__nr">
                <span className="visually-hidden">
                  {t('protokoll.abschnitt6.spalte.nr')}
                </span>
              </TableCell>
              <TableCell className="arten-tabelle__art">
                {t('protokoll.abschnitt6.spalte.art')}
              </TableCell>
              {KLASSEN.map(({ feld, kopfKey, nameKey }) => (
                /* The short form fits the column, the long one is the tooltip.
                   The cells below depend on neither: each names its own class
                   outright. */
                <TableCell key={feld} title={t(nameKey)}>
                  {t(kopfKey)}
                </TableCell>
              ))}
              <TableCell title={t('protokoll.abschnitt6.spalte.summeName')}>
                {t('protokoll.abschnitt6.spalte.summe')}
              </TableCell>
              <TableCell title={t('protokoll.abschnitt6.spalte.nullPlusName')}>
                {t('protokoll.abschnitt6.spalte.nullPlus')}
              </TableCell>
              <TableCell className="arten-tabelle__aktion">
                <span className="visually-hidden">
                  {t('protokoll.abschnitt6.spalte.aktion')}
                </span>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {zeilen.map((nr) => (
              <ArtZeile key={nr} nr={nr} onEntfernen={entfernen} />
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              {/* Spans the row number, the species and the ten classes, so the
                  grand total sits under the Σ column it totals. */}
              <TableCell
                component="th"
                scope="row"
                colSpan={2 + KLASSEN.length}
                className="arten-tabelle__gesamt"
              >
                {t('protokoll.abschnitt6.tabelle.gesamt')}
              </TableCell>
              <TableCell className="arten-tabelle__summe">
                <Gesamtsumme />
              </TableCell>
              <TableCell />
              <TableCell className="arten-tabelle__aktion" />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      {/* Renders nothing. It watches the last row so the table can grow without
          the table itself subscribing to anything. */}
      {!voll && <Zeilenwaechter nr={anzahl as Artnummer} onGefuellt={wachsen} />}

      {/* Both are leaves, so their wide subscriptions re-render themselves and
          nothing above them. The cell messages first, because each names a row
          somebody can go to; the table's own verdict after, because it is about
          all of them. */}
      <Zellmeldungen />
      <NachweisMeldung />

      <div className="tabelle-aktionen">
        <Button
          type="button"
          variant="outlined"
          onClick={wachsen}
          disabled={voll}
          aria-describedby={voll ? 'arten-voll' : undefined}
        >
          {t('protokoll.abschnitt6.tabelle.hinzufuegen')}
        </Button>
        {/* Always rendered, empty until the table is full. A live region added
            to the page at the same moment as its text is unreliably announced;
            one that is already there is not. */}
        <p className="tabelle-aktionen__hinweis" id="arten-voll" role="status">
          {voll ? t('protokoll.abschnitt6.tabelle.voll', { max: MAX_ARTEN }) : ''}
        </p>
      </div>
    </fieldset>
  )
}

export default ArtenTabelle
