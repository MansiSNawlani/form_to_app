import Button from '@mui/material/Button'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { mitAenderung, type Prueflistenabfrage } from '../pruefliste/parameter'
import { pruefungsPfad } from '../pruefliste/pfad'
import { nachbarnAbfrage } from './abfragen'
import type { Nachbar } from './typen'

/* One step through the queue, or the end of it.
 *
 * Drawn either way, because a button that disappears at the edges makes the page
 * head jump about as the reader walks. The page the neighbour sits on travels
 * with it, so crossing a page boundary keeps the crumb pointing at the page the
 * reader is actually in.
 */
function Schritt({
  nachbar,
  abfrage,
  beschriftung,
}: {
  nachbar: Nachbar | null
  abfrage: Prueflistenabfrage
  beschriftung: string
}) {
  const { t } = useTranslation()

  if (nachbar === null) {
    return (
      <Button size="small" variant="outlined" disabled>
        {beschriftung}
      </Button>
    )
  }

  return (
    <Button
      component={Link}
      to={pruefungsPfad(nachbar.id, mitAenderung(abfrage, { seite: nachbar.seite }))}
      size="small"
      variant="outlined"
    >
      {beschriftung}
      {/* Unseen, and read out. Without it both buttons announce a direction and
          nothing about where it leads, the same reason the queue's Pruefen
          buttons each carry their water. */}
      <span className="visually-hidden">
        {t('protokoll.pruefung.schrittGewaesser', { gewaesser: nachbar.gewaessername })}
      </span>
    </Button>
  )
}

/* Vorheriges and Naechstes: a way through the queue rather than into one
 * protocol at a time.
 *
 * Who stands next to this protocol is the server's answer, for the three reasons
 * nachbarn() in backend/app/protokolle/pruefliste/dienst.py sets out.
 *
 * Nothing is drawn when this protocol is not in the list the address names, which
 * is an answer rather than a failure; the crumb stays, because the list is still
 * somewhere to go back to. A failed request is the same silence, for a different
 * reason: an error banner over a protocol that is perfectly readable would be
 * alarming and useless, and there is nothing here to retry.
 */
function Listennavigation({ id, abfrage }: { id: string; abfrage: Prueflistenabfrage }) {
  const { t } = useTranslation()
  const { data: umgebung } = useQuery(nachbarnAbfrage(id, abfrage))

  if (umgebung === undefined || umgebung.position === null) return null

  return (
    <>
      <Schritt
        nachbar={umgebung.vorheriges}
        abfrage={abfrage}
        beschriftung={t('protokoll.pruefung.vorheriges')}
      />
      <Schritt
        nachbar={umgebung.naechstes}
        abfrage={abfrage}
        beschriftung={t('protokoll.pruefung.naechstes')}
      />
    </>
  )
}

export default Listennavigation
