import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { zeitpunktAnzeige } from '../liste/anzeige'
import type { Entwurf } from '../entwurf/typen'
import { verlaufsAbfrage } from './abfragen'
import { verlaufsbeschriftung } from './verlaufsbeschriftung'

/* Everything that has happened to one protocol, newest first.
 *
 * Read by the reviewer deciding on it and by the surveyor who filed it, which is
 * why the query behind it was written as an ordinary one in 11e rather than as a
 * reviewer's. For a rejected protocol this is the only place its author can ever
 * find out why.
 *
 * Newest first is the server's order and nothing here re-sorts it.
 */
function Verlauf({ protokoll }: { protokoll: Entwurf }) {
  const { t } = useTranslation()
  const { data: eintraege, isPending, isError } = useQuery(verlaufsAbfrage(protokoll.id))

  return (
    <section className="card">
      <h2 className="panel__head">{t('protokoll.verlauf.titel')}</h2>
      <div className="panel__body">
        {isPending && (
          /* Said out loud rather than only drawn, the way the protocol's own
             page announces its loading state. */
          <Typography variant="body2" role="status">
            {t('protokoll.verlauf.laedt')}
          </Typography>
        )}

        {/* Never softened into "nothing has happened yet". A history that failed
            to load and a protocol nothing was ever done to look identical on
            screen if this says the wrong one, and the second is a lie about a
            protocol that has certainly at least been submitted. */}
        {isError && <Typography variant="body2">{t('protokoll.verlauf.fehler')}</Typography>}

        {eintraege !== undefined && (
          <ul className="history">
            {eintraege.map((eintrag) => (
              <Zeile
                key={eintrag.id}
                was={t(verlaufsbeschriftung(eintrag.nach_status))}
                wer={eintrag.akteur_name}
                wann={eintrag.created_at}
                kommentar={eintrag.kommentar}
              />
            ))}

            {/* The oldest line, and the only one that is not a recorded event.
                Nothing writes a WorkflowEvent when a draft is created, so the
                server's history can never begin before Eingereicht. Both halves
                of this are certainly true and already on the payload: the draft
                was made by the account that owns it, on that day. */}
            <Zeile
              was={t('protokoll.verlauf.aktion.DRAFT')}
              wer={protokoll.eingereicht_von}
              wann={protokoll.created_at}
              kommentar={null}
            />
          </ul>
        )}
      </div>
    </section>
  )
}

interface ZeileProps {
  was: string
  wer: string
  wann: string
  kommentar: string | null
}

function Zeile({ was, wer, wann, kommentar }: ZeileProps) {
  const { t } = useTranslation()
  const zeitpunkt = zeitpunktAnzeige(wann)

  return (
    <li>
      <strong>{was}</strong> {t('protokoll.verlauf.durch', { person: wer })}
      {/* Left out entirely rather than printed as a gap. A stored moment that
          will not parse is something this screen survives, the same answer the
          page head gives an unreadable survey date. */}
      {zeitpunkt !== null && (
        <>
          <br />
          <time dateTime={wann}>{zeitpunkt}</time>
        </>
      )}
      {kommentar !== null && <blockquote>{kommentar}</blockquote>}
    </li>
  )
}

export default Verlauf
