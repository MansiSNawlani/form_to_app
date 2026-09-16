import { useTranslation } from 'react-i18next'
import NotFound from '../components/NotFound'

/* There is no protocol at this address for this account.
 *
 * **The one message covers two different facts**, and that is the point of it.
 * The backend answers a protocol that does not exist and a protocol this account
 * may not see with the identical refusal, so that a stranger cannot discover
 * which ids are real by reading the difference. Softening this into "you have no
 * permission" on either screen would hand back exactly the fact being withheld,
 * so the sentence lives here once rather than being written again on each page
 * that can reach it.
 */
function ProtokollNichtGefunden() {
  const { t } = useTranslation()

  return (
    <NotFound
      title={t('protokoll.nichtGefunden.titel')}
      text={t('protokoll.nichtGefunden.text')}
    />
  )
}

export default ProtokollNichtGefunden
