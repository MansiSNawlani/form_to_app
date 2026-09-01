import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/* Placeholder page content. Feature 3 replaces this with the real submissions
   list, which is why its strings already sit under the protokolle.list prefix.
   The shell around it now comes from the router's layout route, so this renders
   only the page body. */
function App() {
  const { t } = useTranslation()

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h1">{t('protokolle.list.title')}</Typography>
      <Typography variant="body1">{t('protokolle.list.empty')}</Typography>
      <Button component={Link} to="/protokolle/neu" variant="contained">
        {t('protokolle.list.new')}
      </Button>
    </Stack>
  )
}

export default App
