import { useTranslation } from 'react-i18next'

interface AbschnittPlatzhalterProps {
  title: string
  feature: number
}

/* Stands in for a section that has not been built yet.
   It names the build-plan feature that fills it, so an empty section reads as
   "not yet" rather than as something broken. */
function AbschnittPlatzhalter({ title, feature }: AbschnittPlatzhalterProps) {
  const { t } = useTranslation()

  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      <p className="form-section__hint">
        {t('protokoll.platzhalter.text', { feature })}
      </p>
    </fieldset>
  )
}

export default AbschnittPlatzhalter
