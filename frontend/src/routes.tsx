import { createBrowserRouter, Navigate } from 'react-router'
import Layout from './components/Layout'
import NotFound from './components/NotFound'
import AnmeldungSeite from './auth/AnmeldungSeite'
import SitzungsWaechter from './auth/SitzungsWaechter'
import ProtokolleSeite from './protokoll/liste/ProtokolleSeite'
import PrueflisteSeite from './protokoll/pruefliste/PrueflisteSeite'
import ProtokollSeite from './protokoll/ProtokollSeite'
import PruefungsSeite from './protokoll/pruefung/PruefungsSeite'
import BenutzerlisteSeite from './verwaltung/benutzer/BenutzerlisteSeite'
import { abschnittPfad } from './protokoll/abschnitte'
import { NEU } from './protokoll/entwurf/neu'

/* Route paths are German, decided on 2026-08-24, following the same rule as the
   rest of the domain. Component and variable names around them stay English. */

export const router = createBrowserRouter([
  /* The one screen reachable without a session, and the one outside the app
     shell. Decided on 2026-09-08: a header with an account area, on the single
     page where nobody has an account, reads as a mistake, and there is no
     navigation for the skip link to skip. The guard that requires a session for
     everything else arrives in the next step and wraps the layout route below,
     not this one, or signing in would need somewhere to sign in. */
  { path: '/anmeldung', element: <AnmeldungSeite /> },
  {
    element: <Layout />,
    children: [
      {
        /* Everything below here needs a session. One wrapper rather than a check
           per page, so a route added later inherits the rule instead of having
           to remember it. */
        element: <SitzungsWaechter />,
        children: [
          { index: true, element: <ProtokolleSeite /> },
          {
            /* No loader, and nothing created here.
             *
             * Until 2026-09-10 this route posted a protocol to the server and
             * redirected to it, so merely clicking "Neues Protokoll" left an
             * empty record in the list of somebody who then changed their mind.
             * The record is now created by the first thing typed into it, which
             * ProtokollSeite and the automatic save handle between them.
             *
             * "neu" travels through the same :id parameter as a real protocol,
             * so both addresses match the one route below. That is what lets the
             * address swap from /protokolle/neu to the real id without React
             * Router tearing the page down and taking the cursor with it. */
            path: 'protokolle/neu',
            element: <Navigate to={abschnittPfad(NEU, 1)} replace />,
          },
          { path: 'protokolle/:id/abschnitt/:nr', element: <ProtokollSeite /> },
          /* A protocol that has been handed in, read rather than filled in.
           *
           * No role requirement on the route. The server decides who may read
           * which protocol, in one place, and a second opinion here could only
           * ever be the wrong one: an account that reaches this address without
           * permission is answered with the same "not found" as for an id that
           * does not exist. Hiding a route is not a permission. */
          { path: 'protokolle/:id/pruefung', element: <PruefungsSeite /> },
          /* The review queue, and the one page that reads across every account.
           *
           * No role requirement here either, and for the reason given just
           * above: the endpoint refuses an account that has no business with it,
           * and the page turns that refusal into words with a way onward. Hiding
           * a route is not a permission.
           *
           * Its filters live in the address bar rather than in the page, which
           * is what lets a filtered queue be shared as a link and what feature
           * 12d needs to walk the list from a protocol's own URL. */
          { path: 'pruefung', element: <PrueflisteSeite /> },
          /* Every account in the application, for the Super Admin alone.
           *
           * No role requirement here either, and for the third time for the same
           * reason: the endpoints behind it admit SUPER_ADMIN and nobody else, and
           * the page turns that refusal into words with a way onward. A check here
           * would be a second opinion that can only ever be the wrong one.
           *
           * Nested under /verwaltung rather than sitting at /benutzer, because
           * feature 16 is the first of what project-overview.md lists as an
           * administration area and the address should say which part of the
           * application somebody is in. */
          { path: 'verwaltung/benutzer', element: <BenutzerlisteSeite /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
