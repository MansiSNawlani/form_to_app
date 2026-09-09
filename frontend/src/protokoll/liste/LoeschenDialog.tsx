import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import { protokollName } from './anzeige'
import type { Uebersicht } from '../entwurf/typen'

interface LoeschenDialogProps {
  /** The protocol awaiting confirmation, or null when none is. */
  zeile: Uebersicht | null
  laeuft: boolean
  onAbbrechen: () => void
  onBestaetigen: () => void
}

/* Asks before a draft goes.
 *
 * Deleting is the one action on this page that cannot be taken back. The
 * protocol leaves the server, and its safety copy and attachments leave this
 * browser with it, so there is nothing left to restore it from.
 *
 * The protocol is named by protokollName, which is what every other sentence
 * about a row uses, so the question and the message that follows a failure
 * cannot end up talking about what looks like two different protocols.
 */
function LoeschenDialog({ zeile, laeuft, onAbbrechen, onBestaetigen }: LoeschenDialogProps) {
  const { t } = useTranslation()

  const name =
    zeile === null ? '' : (protokollName(zeile) ?? t('protokolle.list.ohneGewaesser'))

  return (
    <BestaetigungsDialog
      offen={zeile !== null}
      titel={t('protokolle.list.loeschen.titel')}
      text={t('protokolle.list.loeschen.text', { name })}
      abbrechenLabel={t('protokolle.list.loeschen.abbrechen')}
      bestaetigenLabel={t('protokolle.list.loeschen.bestaetigen')}
      laeuft={laeuft}
      onAbbrechen={onAbbrechen}
      onBestaetigen={onBestaetigen}
    />
  )
}

export default LoeschenDialog
