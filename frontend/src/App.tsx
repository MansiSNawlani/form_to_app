import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AppShell from './components/AppShell'

/* Placeholder page content. Feature 4 replaces this with form part 1.
   It is deliberately short, because a short page is what proves the footer
   sits at the bottom of the viewport rather than floating up under the text. */
function App() {
  return (
    <AppShell>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h1">Meine Protokolle</Typography>
        <Typography variant="body1">
          Hier erscheinen die Protokolle, die Sie angelegt haben.
        </Typography>
        <Button variant="contained">Neues Protokoll</Button>
      </Stack>
    </AppShell>
  )
}

export default App
