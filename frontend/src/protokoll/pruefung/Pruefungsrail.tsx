import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useSitzung } from '../../auth/useSitzung'
import type { Entwurf } from '../entwurf/typen'
import Entscheidungspanel from './Entscheidungspanel'
import Panel from './Panel'
import Verlauf from './Verlauf'
import { pruefungsrail } from './entscheidungen'

/* The right-hand column of the reviewer's page: what can be done, then what has
 * been done.
 *
 * Which of the four it draws is entscheidungen.ts's answer. Two of the three
 * that are not the panel say why there is nothing to decide, because a reviewer
 * who expected a panel and got a gap would wonder whether the page had failed to
 * load it. The fourth, nur_verlauf, says nothing on purpose: a Data Steward and
 * a surveyor reading their own protocol were never offered a decision, so an
 * explanation would answer a question neither of them asked.
 *
 * The Verlauf is under all four, because everybody who may read the protocol may
 * read its history, including the surveyor who filed it.
 */
function Pruefungsrail({ protokoll }: { protokoll: Entwurf }) {
  const { t } = useTranslation()
  const sitzung = useSitzung()

  /* Nobody, until /ich has answered. Treating "do not know yet" as a reviewer
     would flash a decision panel at somebody who turns out not to be one. */
  const benutzer = sitzung.zustand === 'angemeldet' ? sitzung.benutzer : undefined

  const rail = pruefungsrail({
    status: protokoll.status,
    rollen: benutzer?.rollen ?? [],
    /* By address, because that is what the protocol carries and what a session
       carries, and it is this application's login identifier, so it is unique. */
    istEigenes: benutzer?.email === protokoll.eingereicht_von,
  })

  return (
    <>
      {rail.art === 'entscheiden' && (
        <Entscheidungspanel entwurfId={protokoll.id} kannAufnehmen={rail.kannAufnehmen} />
      )}

      {rail.art === 'entschieden' && <Hinweiskarte text={t('protokoll.entscheidung.entschieden')} />}

      {rail.art === 'eigenes' && <Hinweiskarte text={t('protokoll.entscheidung.eigenes')} />}

      <Verlauf protokoll={protokoll} />
    </>
  )
}

/* A panel that only says why there is nothing to do. The same head the decision
   panel carries, so the rail keeps its shape whoever is reading it. */
function Hinweiskarte({ text }: { text: string }) {
  const { t } = useTranslation()

  return (
    <Panel titel={t('protokoll.entscheidung.titel')}>
      <Typography variant="body2">{text}</Typography>
    </Panel>
  )
}

export default Pruefungsrail
