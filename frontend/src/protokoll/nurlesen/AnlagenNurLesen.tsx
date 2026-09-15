import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import AnlagenVorschau from '../abschnitte/teil7/AnlagenVorschau'
import AnlagenZustand from '../abschnitte/teil7/AnlagenZustand'
import { anlagenAbfrage } from '../anlagen/abfragen'
import type { Anlage } from '../anlagen/typen'

/* The map excerpt and the photographs, as filed.
 *
 * **Attachments are part of the protocol**, not an extra hanging off it. A
 * reviewer deciding on a survey has not read it until they have seen where the
 * stretch is and what it looked like, so this section matters as much as the
 * answers above it. With the map picker deferred to feature 18, the excerpt and
 * part 1's typed coordinates are the whole of what version 1 knows about where a
 * survey happened.
 *
 * It reads the list with a plain query rather than mounting useAnlagen, which
 * owns an upload queue, per-file refusals and the saving indicator. None of that
 * belongs on a page with no picker on it, and mounting it here would put an
 * uploader behind a screen whose whole promise is that it writes nothing.
 *
 * AnlagenVorschau is the form's own tile, given no children: the children are
 * the buttons that act on an attachment, and there are none to offer.
 */
function AnlagenNurLesen({ entwurfId }: { entwurfId: string }) {
  const { t } = useTranslation()
  const { data: anlagen, isPending, error } = useQuery(anlagenAbfrage(entwurfId))

  /* Loading and failed are told apart, and neither is allowed to look like
     "there are none".

     This is the one wrong answer this section can give, and it is a quiet one: a
     reviewer told a protocol has no map excerpt, when in truth the request
     failed, would send it back for a missing attachment that was there all
     along. AnlagenZustand already words both cases for the form's own blocks,
     including the part that matters most, which is that nothing has been lost. */
  if (isPending) return <AnlagenZustand status="loading" />
  if (error !== null || anlagen === undefined) return <AnlagenZustand status="unavailable" />

  const karte = anlagen.find((anlage) => anlage.art === 'KARTENAUSSCHNITT')
  const fotos = anlagen.filter((anlage) => anlage.art === 'FOTO')

  return (
    <>
      <fieldset className="form-section">
        <legend>{t('protokoll.abschnitt7.kartenausschnitt.legend')}</legend>
        {karte === undefined ? (
          <Leer text={t('protokoll.abschnitt7.kartenausschnitt.statusOhne')} />
        ) : (
          <AnlagenVorschau
            anlage={karte}
            klasse="anlage--einzeln"
            beschreibung={t('protokoll.abschnitt7.kartenausschnitt.alt', {
              dateiname: karte.dateiname,
            })}
          />
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('protokoll.abschnitt7.fotos.legend')}</legend>
        {fotos.length === 0 ? (
          /* Its own wording rather than the form's "Noch keine Fotos", which
             promises more are coming. This protocol has been handed in; what is
             here is all there will ever be. */
          <Leer text={t('protokoll.nurlesen.keineFotos')} />
        ) : (
          <ul className="anlagen__liste">
            {fotos.map((foto, index) => (
              <li key={foto.id}>
                <Foto foto={foto} nummer={index + 1} />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </>
  )
}

function Leer({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  )
}

function Foto({ foto, nummer }: { foto: Anlage; nummer: number }) {
  const { t } = useTranslation()

  return (
    <AnlagenVorschau
      anlage={foto}
      beschreibung={t('protokoll.abschnitt7.fotos.alt', {
        nummer,
        dateiname: foto.dateiname,
      })}
    />
  )
}

export default AnlagenNurLesen
