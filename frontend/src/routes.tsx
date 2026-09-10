import { createBrowserRouter, Navigate } from 'react-router'
import Layout from './components/Layout'
import NotFound from './components/NotFound'
import AnmeldungSeite from './auth/AnmeldungSeite'
import SitzungsWaechter from './auth/SitzungsWaechter'
import ProtokolleSeite from './protokoll/liste/ProtokolleSeite'
import ProtokollSeite from './protokoll/ProtokollSeite'
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
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
