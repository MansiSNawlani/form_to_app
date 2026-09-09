import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../../components/BestaetigungsDialog'

interface EntfernenDialogProps {
  /** The attachment awaiting confirmation, or null when nothing is. */
  dateiname: string | null
  onAbbrechen: () => void
  onBestaetigen: () => void
}

/* Asks before an attachment goes.
 *
 * Removing is the one action here that cannot be taken back: the file lives
 * only in this browser, so there is nothing to restore it from and no undo to
 * offer. Replacing does not ask, because the button says what it does and the
 * picker that opens is itself a second chance.
 *
 * The file is named in the question rather than left as "dieses Foto", for the
 * same reason every refusal names it: twenty tiles look much alike.
 *
 * The dialog itself is components/BestaetigungsDialog.tsx, shared with the
 * delete on "Meine Protokolle" since feature 3c. What is left here is this
 * section's words.
 */
function EntfernenDialog({
  dateiname,
  onAbbrechen,
  onBestaetigen,
}: EntfernenDialogProps) {
  const { t } = useTranslation()

  return (
    <BestaetigungsDialog
      offen={dateiname !== null}
      titel={t('protokoll.abschnitt7.entfernenFrage.titel')}
      text={t('protokoll.abschnitt7.entfernenFrage.text', {
        dateiname: dateiname ?? '',
      })}
      abbrechenLabel={t('protokoll.abschnitt7.entfernenFrage.abbrechen')}
      bestaetigenLabel={t('protokoll.abschnitt7.entfernenFrage.bestaetigen')}
      onAbbrechen={onAbbrechen}
      onBestaetigen={onBestaetigen}
    />
  )
}

export default EntfernenDialog
