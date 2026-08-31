import type { ReactNode } from 'react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import './shell.css'

interface AppShellProps {
  children: ReactNode
}

/* The frame every screen sits inside: header, one main landmark, footer.
   The skip link is first in the DOM so it is the first thing a keyboard user
   reaches, which is the point of it. */
function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <SiteHeader />
      <main className="page" id="inhalt">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export default AppShell
