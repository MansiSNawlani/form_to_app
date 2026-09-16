import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { fehlertext } from '../../api/fehler'
import { entscheidungsfehler } from './entscheidungsfehler'
import { useProtokollAktualisieren } from './useUebergang'

interface UebergangsfehlerProps {
  entwurfId: string
  fehler: unknown
}

/* A refused move, said where the person can act on it.
 *
 * Shared by both moves in the rail. In Pruefung nehmen and a decision fail in
 * the same two ways: somebody else got there first, or something else went
 * wrong, and neither is worth explaining twice in two wordings.
 *
 * Renders nothing for a missing Begruendung, which is the third way and the only
 * one a reviewer puts right by typing. That one belongs beside the box, and
 * printing it here as well would be the same refusal said twice on one screen.
 */
function Uebergangsfehler({ entwurfId, fehler }: UebergangsfehlerProps) {
  const { t } = useTranslation()
  const aktualisieren = useProtokollAktualisieren(entwurfId)

  const stelle = entscheidungsfehler(fehler)
  if (stelle === 'begruendung') return null

  /* Nothing was done wrong and pressing again cannot help, so the way out is the
     current state rather than a retry. */
  if (stelle === 'veraltet') {
    return (
      <div className="entscheidung__fehler" role="alert">
        <Typography variant="body2" className="hinweis__text">
          {t('protokoll.entscheidung.veraltet')}
        </Typography>
        <Button size="small" variant="outlined" onClick={aktualisieren}>
          {t('protokoll.entscheidung.neuLaden')}
        </Button>
      </div>
    )
  }

  /* The backend's own sentence where it sent one, which already names the thing,
     says why and says what to do. fehlertext hands back a key or finished
     German, never both. */
  const text = fehlertext(fehler)

  return (
    <Typography variant="body2" className="entscheidung__fehler" role="alert">
      {text.art === 'schluessel' ? t(text.schluessel) : text.text}
    </Typography>
  )
}

export default Uebergangsfehler
