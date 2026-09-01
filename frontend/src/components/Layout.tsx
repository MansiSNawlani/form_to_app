import { Outlet } from 'react-router'
import AppShell from './AppShell'

/* The router's layout route: the shell is rendered once and every page appears
   inside its main landmark, so navigating between sections never remounts the
   header, the footer or the skip link. */
function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default Layout
