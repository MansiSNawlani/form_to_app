import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// Side-effect import: initialises i18next before any component calls useTranslation.
import './i18n'
import DatumsProvider from './i18n/DatumsProvider'
// Tokens load before the MUI theme reads them, and before any component styles.
import './styles/theme.css'
import { muiTheme } from './theme/muiTheme'
import { RouterProvider } from 'react-router'
import { router } from './routes'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme} defaultMode="system">
      <CssBaseline />
      {/* Outside the router, so the session survives every navigation and is
          asked for once rather than once per page. */}
      <QueryClientProvider client={queryClient}>
        <DatumsProvider>
          <RouterProvider router={router} />
        </DatumsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
