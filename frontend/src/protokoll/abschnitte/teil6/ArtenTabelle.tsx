import Button from '@mui/material/Button'
import { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import ArtZeile from './ArtZeile'
import Gesamtsumme from './Gesamtsumme'
import Zeilenwaechter from './Zeilenwaechter'
import { KLASSEN, MAX_ARTEN } from './tabelle'
import { anfangsZeilen, entfernenSchreiben } from './zeilen'
import type { Antworten, Artnummer } from '../../entwurf/typen'

/* What was caught, by species and size.
 *
 * A real table, not a grid of divs. Thirteen columns of numbers that a surveyor
 * reads down as well as across is the case tables exist for, and the semantics
 * are what let a screen reader answer "which column am I in" at all.
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
  const { getValues, setValue } = useFormContext<Antworten>()

  const [anzahl, setAnzahl] = useState(() => anfangsZeilen(getValues('arten')))

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
      for (const { pfad, wert } of entfernenSchreiben(getValues('arten'), nr)) {
        setValue(pfad, wert, { shouldDirty: true })
      }
      setAnzahl((offen) => Math.max(offen - 1, 1))
    },
    [getValues, setValue],
  )

  return (
    <fieldset className="form-section form-section--tabelle">
      <legend>{t('protokoll.abschnitt6.tabelle.legend')}</legend>
      <p className="form-section__hint">{t('protokoll.abschnitt6.tabelle.hinweis')}</p>

      <div className="tabelle-rahmen">
        <table className="arten-tabelle">
          <caption className="visually-hidden">
            {t('protokoll.abschnitt6.tabelle.beschriftung')}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="arten-tabelle__nr">
                <span className="visually-hidden">
                  {t('protokoll.abschnitt6.spalte.nr')}
                </span>
              </th>
              <th scope="col" className="arten-tabelle__art">
                {t('protokoll.abschnitt6.spalte.art')}
              </th>
              {KLASSEN.map(({ feld, kopfKey, nameKey }) => (
                /* The short form fits the column, the long one is the tooltip.
                   The cells below depend on neither: each names its own class
                   outright. */
                <th scope="col" key={feld} title={t(nameKey)}>
                  {t(kopfKey)}
                </th>
              ))}
              <th scope="col" title={t('protokoll.abschnitt6.spalte.summeName')}>
                {t('protokoll.abschnitt6.spalte.summe')}
              </th>
              <th scope="col" title={t('protokoll.abschnitt6.spalte.nullPlusName')}>
                {t('protokoll.abschnitt6.spalte.nullPlus')}
              </th>
              <th scope="col" className="arten-tabelle__aktion">
                <span className="visually-hidden">
                  {t('protokoll.abschnitt6.spalte.aktion')}
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {zeilen.map((nr) => (
              <ArtZeile key={nr} nr={nr} onEntfernen={entfernen} />
            ))}
          </tbody>

          <tfoot>
            <tr>
              {/* Spans the row number, the species and the ten classes, so the
                  grand total sits under the Σ column it totals. */}
              <th
                scope="row"
                colSpan={2 + KLASSEN.length}
                className="arten-tabelle__gesamt"
              >
                {t('protokoll.abschnitt6.tabelle.gesamt')}
              </th>
              <td className="arten-tabelle__summe">
                <Gesamtsumme />
              </td>
              <td />
              <td className="arten-tabelle__aktion" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Renders nothing. It watches the last row so the table can grow without
          the table itself subscribing to anything. */}
      {!voll && <Zeilenwaechter nr={anzahl as Artnummer} onGefuellt={wachsen} />}

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
