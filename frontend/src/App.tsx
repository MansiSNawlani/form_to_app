import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import AppShell from './components/AppShell'

/* Placeholder page content. Feature 3 replaces this with the real submissions
   list, which is why its strings already sit under the protokolle.list prefix.
   It is deliberately short, because a short page is what proves the footer
   sits at the bottom of the viewport rather than floating up under the text. */
function App() {
  const { t } = useTranslation()

  return (
    <AppShell>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h1">{t('protokolle.list.title')}</Typography>
        <Typography variant="body1">{t('protokolle.list.empty')}</Typography>
        <Button variant="contained">{t('protokolle.list.new')}</Button>
      </Stack>
    </AppShell>
  )
}

export default App
