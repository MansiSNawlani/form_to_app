import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiFehler, ROLLE_FEHLT } from '../../api/fehler'
import { useSitzung } from '../../auth/useSitzung'
import { benutzerAbfrage } from './abfragen'
import BenutzerTabelle from './BenutzerTabelle'
import KeineBerechtigung from './KeineBerechtigung'
import Ladefehler from './Ladefehler'
import LeererZustand from './LeererZustand'
import { gefilterteKonten } from './suche'
import Suchfeld from './Suchfeld'
/* The page furniture is Meine Protokolle's and the review queue's: page__head,
   card and the shared list table. Imported explicitly rather than relying on
   another route having been loaded first, which is the reason AnmeldungSeite
   gives for importing the shell's stylesheet the same way. */
import '../../protokoll/liste/liste.css'
import './benutzerliste.css'

/* Every account in the application, for the one role that may manage them.
 *
 * The first screen to read feature 16a's endpoints. Until it existed the only way
 * to see who had an account was `befischung benutzer liste` in a terminal on the
 * machine the database runs on, which is the dependency the whole of feature 16
 * exists to remove.
 *
 * **No role check here.** The same rule routes.tsx already states for the reviewer's
 * page and the queue: the server decides who may see what, in one place, and a
 * second opinion in the browser could only ever be the wrong one. An account with no
 * business here is refused by the endpoint and told so in words.
 *
 * **The whole list arrives at once.** Feature 16a's endpoint takes no parameters and
 * no page number, on the grounds that accounts are tens rather than unbounded, so
 * there is no pager here and the search box filters what is already in hand.
 *
 * Nothing on this page writes. Creating an account is 16c and changing one is 16d.
 */
function BenutzerlisteSeite() {
  const { t } = useTranslation()
  const sitzung = useSitzung()
  const { data: konten, isPending, error, refetch, isFetching } = useQuery(benutzerAbfrage())

  /* The one piece of state on this screen, and it is the whole of it. Nothing is
     fetched per keystroke and there is no pager, so there is nothing for the
     address bar to carry. */
  const [suche, setSuche] = useState('')

  const sichtbar = useMemo(() => gefilterteKonten(konten ?? [], suche), [konten, suche])

  /* A refusal about the caller rather than about the request. Not an error to
     retry, so it replaces the page rather than sitting above an empty table. */
  if (error instanceof ApiFehler && error.code === ROLLE_FEHLT) {
    return <KeineBerechtigung />
  }

  /* Something was typed, whether or not it narrowed anything. What decides which
     of the two empty states is right, so it is taken from the same trimmed term
     the filter uses rather than from the raw box. */
  const gesucht = suche.trim() !== ''

  return (
    <>
      <div className="page__head">
        <div>
          {/* No count under the heading. The search box carries the only one, as
              a live region, so the total is stated once and by the element that
              has to keep it current while somebody types. */}
          <Typography variant="h1">{t('benutzerverwaltung.titel')}</Typography>
        </div>
      </div>

      <section className="card">
        {/* A live region, so somebody using a screen reader is told the page is
            working rather than left on a heading that never changes. Only the
            first load: a refetch keeps the rows it already has, and replacing a
            full table with "wird geladen" would lose the reader's place. */}
        {isPending && (
          <Typography variant="body1" role="status" className="benutzer__laedt">
            {t('benutzerverwaltung.laedt')}
          </Typography>
        )}

        {/* Only when there is nothing to show instead. A background refetch can
            fail over perfectly good rows, and saying the list could not be loaded
            above a table of it is both alarming and untrue. */}
        {error !== null && konten === undefined && (
          <Ladefehler fehler={error} laeuft={isFetching} onErneut={() => void refetch()} />
        )}

        {/* The box is drawn as soon as the list is in hand, including when the
            search has narrowed it to nothing: it is the only way to undo that. */}
        {konten !== undefined && konten.length > 0 && (
          <Suchfeld
            suche={suche}
            onSuche={setSuche}
            angezeigt={sichtbar.length}
            gesamt={konten.length}
          />
        )}

        {konten !== undefined && sichtbar.length === 0 && (
          <LeererZustand gesucht={gesucht} onZuruecksetzen={() => setSuche('')} />
        )}

        {sichtbar.length > 0 && (
          <BenutzerTabelle
            konten={sichtbar}
            /* Null while the session is still being checked rather than a guess,
               which is the same reason the guard has three states rather than a
               boolean. No row is marked for that one render instead of the wrong
               row being marked. */
            eigeneId={sitzung.zustand === 'angemeldet' ? sitzung.benutzer.id : null}
          />
        )}
      </section>
    </>
  )
}

export default BenutzerlisteSeite
