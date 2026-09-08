import { createBrowserRouter, redirect } from 'react-router'
import Layout from './components/Layout'
import NotFound from './components/NotFound'
import App from './App'
import AnmeldungSeite from './auth/AnmeldungSeite'
import ProtokollSeite from './protokoll/ProtokollSeite'
import { abschnittPfad } from './protokoll/abschnitte'
import { entwurfStore } from './protokoll/entwurf/store'

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
      { index: true, element: <App /> },
      {
        /* A loader rather than a component, because creating a draft is the
           whole point of this route and there is nothing to render. Loaders run
           once per navigation, unlike an effect under StrictMode, so this cannot
           leave a stray empty draft behind. */
        path: 'protokolle/neu',
        loader: () => redirect(abschnittPfad(entwurfStore.createEntwurf().id, 1)),
      },
      { path: 'protokolle/:id/abschnitt/:nr', element: <ProtokollSeite /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
