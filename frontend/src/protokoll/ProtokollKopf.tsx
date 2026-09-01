import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import SpeicherAnzeige from './SpeicherAnzeige'
import type { SaveState } from './entwurf/useAutoSave'
import type { Entwurf } from './entwurf/typen'

interface ProtokollKopfProps {
  entwurf: Entwurf
  saveState: SaveState
}

function ProtokollKopf({ entwurf, saveState }: ProtokollKopfProps) {
  const { t, i18n } = useTranslation()

  const angelegtAm = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'long',
  }).format(new Date(entwurf.angelegtAm))

  return (
    <div className="page__head">
      <div>
        {/* Feature 4b replaces this with the Gewässername and the Ortsangabe, as
            in the mockup. Neither field exists yet. */}
        <Typography variant="h1">{t('protokoll.kopf.titel')}</Typography>
        <p className="page__sub">
          {t('protokoll.kopf.entwurf')}
          {' · '}
          {t('protokoll.kopf.angelegtAm', { datum: angelegtAm })}
          {' · '}
          {t('shell.footer.formVersion', { version: entwurf.formVersion })}
        </p>
      </div>
      <div className="page__head-actions">
        <SpeicherAnzeige {...saveState} />
        <Button component={Link} to="/" size="small" variant="outlined">
          {t('protokoll.kopf.alleProtokolle')}
        </Button>
      </div>
    </div>
  )
}

export default ProtokollKopf
