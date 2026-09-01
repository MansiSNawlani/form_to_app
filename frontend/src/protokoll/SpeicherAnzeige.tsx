import { useTranslation } from 'react-i18next'
import type { SaveState } from './entwurf/useAutoSave'

/* The dot is decorative: colour alone never carries the meaning, the text beside
   it always says the same thing.

   The indicator appears twice on the page, at the head and at the foot of the
   card, but only one of them may be a live region. Two would announce every save
   twice. */
function SpeicherAnzeige({ live = true, ...state }: SaveState & { live?: boolean }) {
  const { t, i18n } = useTranslation()

  function text() {
    switch (state.status) {
      case 'saving':
        return t('protokoll.speichern.speichert')
      case 'failed':
        return t('protokoll.speichern.fehler')
      case 'saved':
        return t('protokoll.speichern.gespeichertUm', {
          zeit: new Intl.DateTimeFormat(i18n.language, {
            timeStyle: 'short',
          }).format(new Date(state.zeitpunkt)),
        })
      default:
        return t('protokoll.speichern.unveraendert')
    }
  }

  return (
    <span
      className={`save-state save-state--${state.status}`}
      role={live ? 'status' : undefined}
    >
      <span className="save-state__dot" aria-hidden="true" />
      {text()}
    </span>
  )
}

export default SpeicherAnzeige
