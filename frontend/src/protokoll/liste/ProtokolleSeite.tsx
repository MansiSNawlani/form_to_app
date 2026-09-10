import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { protokolleAbfrage } from '../entwurf/abfragen'
import { zaehlungen } from './anzeige'
import Ladefehler from './Ladefehler'
import LeererZustand from './LeererZustand'
import LoeschenDialog from './LoeschenDialog'
import Loeschfehler from './Loeschfehler'
import ProtokollTabelle from './ProtokollTabelle'
import { useLoeschen } from './useLoeschen'
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
  const loeschen = useLoeschen()

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

      {/* Only when there is nothing to show instead. The list may be refetched
          freely, so a refetch can fail while perfectly good rows are on screen,
          and saying the protocols could not be loaded above a table of them is
          both alarming and untrue. */}
      {error !== null && zeilen === undefined && (
        <Ladefehler fehler={error} laeuft={isFetching} onErneut={() => void refetch()} />
      )}

      {loeschen.fehlgeschlagen !== null && (
        <Loeschfehler zeile={loeschen.fehlgeschlagen} fehler={loeschen.fehler} />
      )}

      {zeilen !== undefined && zeilen.length === 0 && <LeererZustand />}

      {zeilen !== undefined && zeilen.length > 0 && (
        <ProtokollTabelle zeilen={zeilen} jetzt={jetzt} onLoeschen={loeschen.frage} />
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
