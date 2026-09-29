import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams } from 'react-router'
import { ApiFehler, KONTO_NICHT_GEFUNDEN, ROLLE_FEHLT } from '../../api/fehler'
import { BENUTZERVERWALTUNG } from '../../auth/startseite'
import { useSitzung } from '../../auth/useSitzung'
import { zeitpunktAnzeige } from '../../protokoll/liste/anzeige'
import { kontoAbfrage } from './abfragen'
import Angabenkarte from './Angabenkarte'
import { kontostatusSchluessel } from './anzeige'
import KeinKonto from './KeinKonto'
import KeineBerechtigung from './KeineBerechtigung'
import Ladefehler from './Ladefehler'
import Passwortkarte from './Passwortkarte'
import Zugangskarte from './Zugangskarte'
/* The page furniture is the list pages': page__head and card. Imported
   explicitly rather than relying on another route having been loaded first,
   which is the reason AnmeldungSeite gives for importing the shell's stylesheet
   the same way. */
import '../../protokoll/liste/liste.css'
import './kontoanlegen.css'
import './kontoaendern.css'

/* One account, changed by the one role that may.
 *
 * The last screen of feature 16, and the half the command line never had:
 * `befischung benutzer` can create an account, list accounts, lock one and unlock
 * one, but it cannot change one. Until this screen existed a mistyped address
 * produced an account nobody could sign in to and nobody could repair, and a
 * forgotten password waited for whoever had shell access on the machine the
 * database runs on.
 *
 * **No role check here**, the same rule routes.tsx already states for the account
 * list, the create form, the reviewer's page and the queue: the server decides who
 * may do what, in one place, and a second opinion in the browser could only ever be
 * the wrong one.
 *
 * **Three cards, and each one's button does only what its own card says.** Somebody
 * who types a new address, thinks better of it and then presses "Konto sperren"
 * must not have the address saved along with the lock, so the Zugang card builds
 * its request from the account rather than from the form, and the password card
 * reads no field of the form at all.
 */
function KontoAendernSeite() {
  const { t } = useTranslation()
  const { id = '' } = useParams<{ id: string }>()
  const sitzung = useSitzung()

  const { data: konto, isPending, error, refetch, isFetching } = useQuery(kontoAbfrage(id))

  /* Whose account this is. Null while the session is still being checked rather
     than a guess, which is the same reason the guard has three states rather than
     a boolean: for that one render nothing is marked, instead of the wrong thing
     being marked. */
  const eigeneId = sitzung.zustand === 'angemeldet' ? sitzung.benutzer.id : null
  const istEigenes = konto !== undefined && konto.id === eigeneId

  /* A refusal about the caller rather than about the request. Not an error to
     retry, so it replaces the page rather than sitting above an empty form. */
  if (error instanceof ApiFehler && error.code === ROLLE_FEHLT) {
    return <KeineBerechtigung />
  }

  /* Settled in the same way, and for the same reason it carries no retry. */
  if (error instanceof ApiFehler && error.code === KONTO_NICHT_GEFUNDEN) {
    return <KeinKonto />
  }

  return (
    <>
      <div className="page__head">
        <div>
          {/* The way back, at the top, where a reader looks for it.
           *
           * A breadcrumb rather than a button among the save actions, decided on
           * 2026-09-28: leaving this page is navigation, not one of the things
           * this screen does to the account, and a link sitting beside
           * "Aenderungen speichern" reads as a third action of equal weight.
           *
           * The trail names the section and then this page's kind, not the
           * address. The heading right below is already the address, and a crumb
           * repeating it would say the same thing twice in two lines.
           *
           * In a named <nav> of its own, which is what a breadcrumb is: it gives a
           * screen reader a landmark to jump to, and it is what tells this link
           * apart from the header's own "Benutzerverwaltung", which points at the
           * same place and would otherwise be indistinguishable by name. */}
          <nav aria-label={t('benutzerverwaltung.aendern.krumen')}>
            <p className="page__sub page__krumen">
              <Link component={RouterLink} to={BENUTZERVERWALTUNG} className="krume">
                {t('benutzerverwaltung.titel')}
              </Link>
              <span className="krume-trenner">{' › '}</span>
              {t('benutzerverwaltung.aendern.titel')}
            </p>
          </nav>

          {/* The address is the account's only name, so it is the heading rather
              than a generic one with the address underneath. It follows the
              account: renaming an account in the first card changes what this
              says, which is the confirmation that the save took. */}
          <Typography variant="h1">
            {konto?.email ?? t('benutzerverwaltung.aendern.titel')}
          </Typography>
          {konto !== undefined && (
            <p className="page__sub">
              {t('benutzerverwaltung.aendern.kopf', {
                angelegt: zeitpunktAnzeige(konto.created_at),
                status: t(kontostatusSchluessel(konto.ist_aktiv)),
              })}
              {/* Said rather than only marked, because which account is yours
                  decides what this screen will not let you do to it. */}
              {istEigenes && ` ${t('benutzerverwaltung.aendern.eigenes')}`}
            </p>
          )}
        </div>
      </div>

      {/* A live region, so somebody using a screen reader is told the page is
          working rather than left on a heading that never changes. */}
      {isPending && (
        <section className="card">
          <Typography variant="body1" role="status" className="benutzer__laedt">
            {t('benutzerverwaltung.aendern.laedt')}
          </Typography>
        </section>
      )}

      {konto !== undefined && (
        <div className="konto-aendern">
          <Angabenkarte konto={konto} eigeneId={eigeneId} />
          <Zugangskarte konto={konto} eigeneId={eigeneId} />
          <Passwortkarte konto={konto} eigeneId={eigeneId} />
        </div>
      )}

      {/* Only when there is nothing to show instead. A background refetch can fail
          over a perfectly good account, and saying it could not be loaded above a
          form full of it is both alarming and untrue. */}
      {error !== null && konto === undefined && (
        <section className="card">
          <div className="benutzer__meldung">
            <Ladefehler
              fehler={error}
              laeuft={isFetching}
              onErneut={() => void refetch()}
              titel={t('benutzerverwaltung.aendern.ladefehler')}
            />
          </div>
        </section>
      )}
    </>
  )
}

export default KontoAendernSeite
