import Button from '@mui/material/Button'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import ProtokollTitel from './ProtokollTitel'
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
  }).format(new Date(entwurf.created_at))

  return (
    <div className="page__head">
      <div>
        <ProtokollTitel />
        {/* A protocol that has not been created yet has no creation date worth
            printing and no form version: the server stamps both when it makes
            the record. Printing "angelegt am heute" for something that does not
            exist would be the one line on this page that is not true. */}
        <p className="page__sub">
          {t('protokoll.kopf.entwurf')}
          {entwurf.form_version !== '' && (
            <>
              {' · '}
              {t('protokoll.kopf.angelegtAm', { datum: angelegtAm })}
              {' · '}
              {t('shell.footer.formVersion', { version: entwurf.form_version })}
            </>
          )}
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
