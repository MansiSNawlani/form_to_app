import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { BenutzerAntwort, DemoRolle } from '../api/typen'
import { useFehlertext } from '../api/useFehlertext'
import { demoAbfrage, useDemoAnmeldung } from './useSitzung'

const DEMO_KNOEPFE: readonly { rolle: DemoRolle; labelKey: ParseKeys }[] = [
  { rolle: 'SUBMITTER', labelKey: 'anmeldung.demo.einreicher' },
  { rolle: 'REVIEWER', labelKey: 'anmeldung.demo.pruefer' },
]

interface DemoZugangProps {
  onAngemeldet: (benutzer: BenutzerAntwort) => void
}

/* The two demo buttons, drawn only where the server says the demo is on.
 *
 * Hiding them is a convenience and nothing more: the server refuses a demo
 * sign-in by itself when the switch is off, so a deployment with real protocols
 * is protected whatever this component does. */
function DemoZugang({ onAngemeldet }: DemoZugangProps) {
  const { t } = useTranslation()
  const { data } = useQuery(demoAbfrage)
  const demo = useDemoAnmeldung()
  const abgelehnt = useFehlertext(demo.error)

  if (!data?.aktiv) return null

  return (
    <section className="anmeldung__demo" aria-labelledby="anmeldung-demo-titel">
      <Divider />
      <Typography variant="h2" id="anmeldung-demo-titel">
        {t('anmeldung.demo.titel')}
      </Typography>
      <Typography variant="body1" className="anmeldung__einleitung">
        {t('anmeldung.demo.hinweis')}
      </Typography>
      {abgelehnt && (
        <Alert severity="error" role="alert">
          {abgelehnt}
        </Alert>
      )}
      {DEMO_KNOEPFE.map(({ rolle, labelKey }) => (
        <Button
          key={rolle}
          variant="outlined"
          fullWidth
          disabled={demo.isPending}
          onClick={() => demo.mutate(rolle, { onSuccess: onAngemeldet })}
        >
          {t(labelKey)}
        </Button>
      ))}
    </section>
  )
}

export default DemoZugang
