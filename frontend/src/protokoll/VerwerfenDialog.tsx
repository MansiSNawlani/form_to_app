import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../components/BestaetigungsDialog'

interface VerwerfenDialogProps {
  offen: boolean
  onBleiben: () => void
  onVerwerfen: () => void
}

/* Asks on the way out of a protocol that was never created.
 *
 * Mild on purpose, and it is the one dialog on this screen that is. Nothing is
 * at stake: the protocol has no record on the server, because nothing has been
 * typed into it, so leaving loses nothing that exists. The question is there to
 * say that plainly rather than to guard anything, which is why the button that
 * leaves is an ordinary one and not the red button a delete gets.
 *
 * A protocol somebody has actually typed into never reaches this. It was
 * created and saved by that first keystroke, so leaving it is exactly what the
 * form is built for and asking would contradict the promise the save indicator
 * makes.
 */
function VerwerfenDialog({ offen, onBleiben, onVerwerfen }: VerwerfenDialogProps) {
  const { t } = useTranslation()

  return (
    <BestaetigungsDialog
      offen={offen}
      titel={t('protokoll.verwerfen.titel')}
      text={t('protokoll.verwerfen.text')}
      abbrechenLabel={t('protokoll.verwerfen.bleiben')}
      bestaetigenLabel={t('protokoll.verwerfen.verwerfen')}
      bestaetigenFarbe="primary"
      onAbbrechen={onBleiben}
      onBestaetigen={onVerwerfen}
    />
  )
}

export default VerwerfenDialog
