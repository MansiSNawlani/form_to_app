import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { protokolleAbfrage } from '../entwurf/abfragen'
import { zaehlungen } from './anzeige'
import LeererZustand from './LeererZustand'
import LoeschenDialog from './LoeschenDialog'
import ProtokollZeile from './ProtokollZeile'
import { useLoeschen } from './useLoeschen'
import { useFehlertext } from '../../api/useFehlertext'
import './liste.css'

/* The home page: this account's own protocols.
 *
 * It replaced a placeholder in feature 3c. Until then the only way back into a
 * protocol was the address of the page it was on, so closing the tab lost it in
 * practice even though the server still held it.
 *
 * The list is the query's, unfiltered and unsorted here. The endpoint answers
 * most recently worked on first and takes no parameters at all; searching and
 * filtering belong to feature 12's review queue, which reads across every
 * account rather than one person's handful.
 */
function ProtokolleSeite() {
  const { t } = useTranslation()

  const { data: zeilen, isPending, error, refetch, isFetching } = useQuery(protokolleAbfrage())
  const fehlertext = useFehlertext(error)
  const loeschen = useLoeschen()
  const loeschfehlertext = useFehlertext(loeschen.fehler)

  const zahlen = zeilen === undefined ? undefined : zaehlungen(zeilen)

  /* One clock reading for the whole render, so every row agrees on which day is
     "heute". Read here rather than in each row, where twenty rows would take
     twenty readings and a list drawn across midnight could disagree with
     itself. */
  const jetzt = new Date()

  return (
    <>
      <div className="page__head">
        <div>
          <Typography variant="h1">{t('protokolle.list.title')}</Typography>
          {zahlen !== undefined && zahlen.gesamt > 0 && (
            <p className="page__sub">
              {zahlen.entwuerfe === 0
                ? t('protokolle.list.anzahl', { count: zahlen.gesamt })
                : t('protokolle.list.anzahlMitEntwuerfen', {
                    count: zahlen.gesamt,
                    entwuerfe: t('protokolle.list.entwuerfe', { count: zahlen.entwuerfe }),
                  })}
            </p>
          )}
        </div>
        <div className="page__head-actions">
          <Button component={Link} to="/protokolle/neu" variant="contained">
            {t('protokolle.list.new')}
          </Button>
        </div>
      </div>

      {/* A live region, so somebody using a screen reader is told the page is
          working rather than left on a heading that never changes. */}
      {isPending && (
        <Typography variant="body1" role="status">
          {t('protokolle.list.laedt')}
        </Typography>
      )}

      {/* Nothing is wrong with the protocols themselves, so this says so and
          offers another go rather than leaving a page that looks like an account
          with no work in it. */}
      {error !== null && (
        <Alert severity="error">
          <AlertTitle>{t('protokolle.list.ladefehler.titel')}</AlertTitle>
          <Typography variant="body2" className="hinweis__text">
            {fehlertext ?? t('protokolle.list.ladefehler.text')}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {t('protokolle.list.ladefehler.erneut')}
          </Button>
        </Alert>
      )}

      {/* Names the protocol that is still there, because a message about "das
          Protokoll" over a list of several says nothing about which one. */}
      {loeschen.fehlgeschlagen !== null && (
        <Alert severity="error">
          <AlertTitle>{t('protokolle.list.loeschfehler.titel')}</AlertTitle>
          <Typography variant="body2">
            {t('protokolle.list.loeschfehler.text', {
              name:
                loeschen.fehlgeschlagen.gewaessername ?? t('protokolle.list.ohneGewaesser'),
            })}{' '}
            {loeschfehlertext}
          </Typography>
        </Alert>
      )}

      {zeilen !== undefined && zeilen.length === 0 && <LeererZustand />}

      {zeilen !== undefined && zeilen.length > 0 && (
        <section className="card">
          <TableContainer className="tabelle--liste">
            <Table>
              {/* The table's accessible name. A caption rather than aria-label,
                  so it is announced by every screen reader and stays in the
                  locale file with every other string. */}
              <caption className="visually-hidden">
                {t('protokolle.list.tabelle.beschriftung')}
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell>{t('protokolle.list.tabelle.gewaesser')}</TableCell>
                  <TableCell>{t('protokolle.list.tabelle.datum')}</TableCell>
                  <TableCell>{t('protokolle.list.tabelle.anlass')}</TableCell>
                  <TableCell>{t('protokolle.list.tabelle.status')}</TableCell>
                  <TableCell>{t('protokolle.list.tabelle.bearbeitet')}</TableCell>
                  {/* The action column's heading is for screen readers only:
                      sighted readers have the buttons themselves, and a printed
                      "Aktion" over a column of buttons is noise. */}
                  <TableCell>
                    <span className="visually-hidden">
                      {t('protokolle.list.tabelle.aktion')}
                    </span>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zeilen.map((zeile) => (
                  <ProtokollZeile
                    key={zeile.id}
                    zeile={zeile}
                    jetzt={jetzt}
                    onLoeschen={loeschen.frage}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      )}

      <LoeschenDialog
        zeile={loeschen.angefragt}
        laeuft={loeschen.laeuft}
        onAbbrechen={loeschen.abbrechen}
        onBestaetigen={loeschen.bestaetigen}
      />
    </>
  )
}

export default ProtokolleSeite
