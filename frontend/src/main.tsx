import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// Tokens load before the MUI theme reads them, and before any component styles.
import './styles/theme.css'
import { muiTheme } from './theme/muiTheme'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme} defaultMode="system">
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
