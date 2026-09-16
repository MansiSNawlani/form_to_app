import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useSitzung } from '../../auth/useSitzung'
import type { Entwurf } from '../entwurf/typen'
import Entscheidungspanel from './Entscheidungspanel'
import Verlauf from './Verlauf'
import { pruefungsrail } from './entscheidungen'

/* The right-hand column of the reviewer's page: what can be done, then what has
 * been done.
 *
 * Which of the four it draws is entscheidungen.ts's answer, and the three that
 * are not the panel are a sentence rather than nothing at all. A rail that
 * simply left the panel out would leave a reviewer wondering whether the page
 * had failed to load it.
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

/* A panel that only says why there is nothing to do. Same card and same head as
   the decision panel, so the rail keeps its shape whoever is reading it. */
function Hinweiskarte({ text }: { text: string }) {
  const { t } = useTranslation()

  return (
    <section className="card">
      <h2 className="panel__head">{t('protokoll.entscheidung.titel')}</h2>
      <div className="panel__body">
        <Typography variant="body2">{text}</Typography>
      </div>
    </section>
  )
}

export default Pruefungsrail
