import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiFehler, ROLLE_FEHLT } from '../../api/fehler'
import { prueflisteAbfrage } from './abfragen'
import Filterleiste from './Filterleiste'
import KeineBerechtigung from './KeineBerechtigung'
import Ladefehler from './Ladefehler'
import LeererZustand from './LeererZustand'
import Pager from './Pager'
import PrueflistenTabelle from './PrueflistenTabelle'
import {
  abfrageAus,
  alsSuchparameter,
  istGefiltert,
  mitAenderung,
  STANDARD,
  type Aenderung,
} from './parameter'
/* The two-line cells and the empty-state column are Meine Protokolle's, and both
   lists are the same kind of screen. Imported explicitly rather than relying on
   the other route having been loaded first, which is the reason AnmeldungSeite
   gives for importing the shell's stylesheet the same way. */
import '../liste/liste.css'
import './pruefliste.css'

/* The review queue: every protocol that has been handed in, whoever filed it.
 *
 * The first list in this application that reads across accounts. Meine Protokolle
 * answers "what have I got"; this answers "what is waiting for FFS", and the two
 * are deliberately two screens and two endpoints. A draft is somebody's unfinished
 * work rather than work waiting for FFS, so none appears here, including the
 * reader's own.
 *
 * **No role check here.** The same rule routes.tsx already states for the
 * reviewer's page: the server decides who may see what, in one place, and a
 * second opinion in the browser could only ever be the wrong one. An account with
 * no business here is refused by the endpoint and told so in words.
 *
 * **The address bar is this screen's state.** Every filter, the order and the page
 * are read from it and written back to it, never held in component state. That is
 * what makes a reload come back to the same list, a filtered queue shareable as a
 * link, and feature 12d possible at all: Vorheriges and Naechstes have to rebuild
 * this list from a URL alone, which they could not do if the list depended on
 * what the reviewer happened to click earlier.
 */
function PrueflisteSeite() {
  const { t } = useTranslation()
  const [suchparameter, setSuchparameter] = useSearchParams()

  const abfrage = abfrageAus(suchparameter)
  const { data: seite, isPending, error, refetch, isFetching } = useQuery(
    prueflisteAbfrage(abfrage),
  )

  /* Every change to the list goes through the address bar, and through
     mitAenderung on the way, which is what returns the reader to the first page
     when the list itself changed.

     Pushing a history entry by default, so Back undoes the last thing the reader
     did to the list rather than leaving the screen entirely. Only the search box
     replaces instead, and only because it fires on a pause in typing: pushed, a
     six-letter water name would put six entries in the history and Back would
     walk out of it one letter at a time. */
  const aendern = useCallback(
    (aenderung: Aenderung, ersetzen = false) => {
      setSuchparameter(alsSuchparameter(mitAenderung(abfrageAus(suchparameter), aenderung)), {
        replace: ersetzen,
      })
    },
    [suchparameter, setSuchparameter],
  )

  const zuruecksetzen = useCallback(() => {
    setSuchparameter(alsSuchparameter(STANDARD), { replace: true })
  }, [setSuchparameter])

  /* A refusal about the caller rather than about the request. Not an error to
     retry, so it replaces the page rather than sitting above an empty table. */
  if (error instanceof ApiFehler && error.code === ROLLE_FEHLT) {
    return <KeineBerechtigung />
  }

  const zeilen = seite?.zeilen ?? []

  return (
    <>
      <div className="page__head">
        <div>
          <Typography variant="h1">{t('pruefliste.titel')}</Typography>
          {seite !== undefined && (
            <p className="page__sub">{t('pruefliste.anzahl', { count: seite.gesamt })}</p>
          )}
        </div>
      </div>

      <section className="card">
        <Filterleiste abfrage={abfrage} onAendern={aendern} />

        {/* A live region, so somebody using a screen reader is told the page is
            working rather than left on a heading that never changes. Only the
            first load: a refetch keeps the rows it already has, and replacing a
            full table with "wird geladen" on every filter change would lose the
            reader's place. */}
        {isPending && (
          <Typography variant="body1" role="status" className="pruefliste__laedt">
            {t('pruefliste.laedt')}
          </Typography>
        )}

        {/* Only when there is nothing to show instead. This list refetches
            freely, so a refetch can fail over perfectly good rows, and saying the
            queue could not be loaded above a table of it is both alarming and
            untrue. */}
        {error !== null && seite === undefined && (
          <div className="pruefliste__meldung">
            <Ladefehler fehler={error} laeuft={isFetching} onErneut={() => void refetch()} />
          </div>
        )}

        {/* gesamt, not the rows on this page. A page past the end also comes back
            with no rows, and it is not empty in the sense this state means: there
            are protocols behind it and a pager that can reach them, so telling
            the reader nothing matched would be untrue and the reset button would
            offer to undo filters they never set. */}
        {seite !== undefined && seite.gesamt === 0 && (
          <LeererZustand gefiltert={istGefiltert(abfrage)} onZuruecksetzen={zuruecksetzen} />
        )}

        {zeilen.length > 0 && <PrueflistenTabelle zeilen={zeilen} abfrage={abfrage} />}

        {/* Drawn whenever there is anything to page through, including on a page
            past the end, where it is the only way back. */}
        {seite !== undefined && seite.gesamt > 0 && (
          <Pager
            seite={seite.seite}
            seiten={seite.seiten}
            onSeite={(neue) => aendern({ seite: neue })}
          />
        )}
      </section>
    </>
  )
}

export default PrueflisteSeite
