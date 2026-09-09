import { createBrowserRouter, redirect } from 'react-router'
import Layout from './components/Layout'
import NotFound from './components/NotFound'
import App from './App'
import AnmeldungSeite from './auth/AnmeldungSeite'
import SitzungsWaechter from './auth/SitzungsWaechter'
import { sitzungsAbfrage } from './auth/useSitzung'
import { anmeldungsZiel } from './auth/weiter'
import { queryClient } from './api/queryClient'
import ProtokollSeite from './protokoll/ProtokollSeite'
import ProtokollAnlegenFehler from './protokoll/ProtokollAnlegenFehler'
import { abschnittPfad } from './protokoll/abschnitte'
import { legeEntwurfAn } from './protokoll/entwurf/api'
import { entwurfsKey } from './protokoll/entwurf/abfragen'

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
          { index: true, element: <App /> },
          {
            /* A loader rather than a component, because creating a draft is the
               whole point of this route and there is nothing to render. Loaders
               run once per navigation, unlike an effect under StrictMode, so
               this cannot leave a stray empty draft behind.

               It checks the session itself, which looks like a duplicate of the
               guard above and is not. Loaders run before anything renders, and
               React Router runs the matched routes' loaders together rather than
               parent first, so the guard cannot stop this one. Without the check
               here, opening this address while signed out would create an empty
               draft, redirect to it, and only then be sent to the login page,
               leaving litter in the browser of somebody who never signed in. */
            path: 'protokolle/neu',
            loader: async () => {
              const benutzer = await queryClient.ensureQueryData(sitzungsAbfrage)
              if (benutzer === null) return redirect(anmeldungsZiel('/protokolle/neu'))

              /* Creating it can fail now that it is a request. Nothing is caught
                 here: a thrown ApiFehler is what React Router hands to the
                 errorElement below, which is the one place that has somewhere to
                 show it. */
              const entwurf = await legeEntwurfAn()

              /* Straight into the cache the protocol page reads, so the redirect
                 that follows renders the draft we are holding instead of asking
                 the server again for a document we just received. */
              queryClient.setQueryData(entwurfsKey(entwurf.id), entwurf)

              return redirect(abschnittPfad(entwurf.id, 1))
            },
            errorElement: <ProtokollAnlegenFehler />,
          },
          { path: 'protokolle/:id/abschnitt/:nr', element: <ProtokollSeite /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
