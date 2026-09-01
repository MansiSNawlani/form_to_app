import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

interface NotFoundProps {
  title?: string
  text?: string
}

/* Shown for an unknown URL, and for a draft id that is not in this browser.

   The wording is a prop rather than a key built at runtime because i18next's
   keys are type-checked against the German locale, and a key assembled from a
   variable defeats that check. It defaults to the unknown-address wording. */
function NotFound({ title, text }: NotFoundProps) {
  const { t } = useTranslation()

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h1">{title ?? t('shell.nichtGefunden.titel')}</Typography>
      <Typography variant="body1">{text ?? t('shell.nichtGefunden.text')}</Typography>
      <Link className="shell-link" to="/">
        {t('protokoll.kopf.alleProtokolle')}
      </Link>
    </Stack>
  )
}

export default NotFound
