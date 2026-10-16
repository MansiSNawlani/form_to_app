import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Locale } from '../../i18n/sprachen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'
import FeldText from '../felder/FeldText'
import { entfernungText } from '../gewaessernetz/auswahl'
import { useNurLesen } from '../nurlesen/kontext'
import {
  BEGRUENDUNG,
  EINGERASTET,
  GESETZT,
  GRENZEN,
  ferne,
  lagen,
  type Lage,
  type Punktangaben,
} from './einrasten'
import type { Grenze } from './Grenzwahl'

type Angabe = Exclude<keyof Punktangaben, 'unsicher'>

/* Every answer the panel reads, each with the point and the property it fills,
   so the values useWatch returns in this order can be put back by name. */
const GELESEN: ReadonlyArray<readonly [Grenze, Angabe, AntwortPfad]> = GRENZEN.flatMap(
  (grenze) =>
    [
      [grenze, 'rwGesetzt', GESETZT[grenze].rw],
      [grenze, 'hwGesetzt', GESETZT[grenze].hw],
      [grenze, 'rw', EINGERASTET[grenze].rw.pfad],
      [grenze, 'hw', EINGERASTET[grenze].hw.pfad],
      [grenze, 'name', EINGERASTET[grenze].name.pfad],
    ] as const,
)
const PFADE = GELESEN.map(([, , pfad]) => pfad)

/* LUBW's placeholder for a water without a name, NN-YBP and the like. The
   search leaves these out by the same prefix, PLATZHALTER in
   backend/app/gewaessernetz/suche.py. */
const PLATZHALTER = /^NN-/

interface EinrastanzeigeProps {
  /** Points whose position on the water is being asked for again. */
  unsicher: Readonly<Record<Grenze, boolean>>
}

/* Under the map: for each boundary point, which water it lies by and how far,
   a button that moves the typed point onto the water, and when a point is far
   a warning and the box for the reason the submit then asks for.

   Read from the stored answers, so the review screen shows what was filed and
   a draft shows what useEinrasten last wrote. Nothing shows for a point with no
   position on the water (no valid coordinates, no network loaded) or one being
   asked about again, in which case the map works exactly as it did before 18d. */
function Einrastanzeige({ unsicher }: EinrastanzeigeProps) {
  const { t, i18n } = useTranslation()
  const titelId = useId()
  const nurLesen = useNurLesen()
  const { setValue } = useFormContext<Antworten>()
  const werte = useWatch<Antworten>({ name: PFADE }) as readonly (string | undefined)[]
  const begruendung = useWatch<Antworten>({ name: BEGRUENDUNG.pfad }) as string | undefined
  const sprache = i18n.language as Locale

  const angaben: Record<Grenze, Punktangaben> = {
    unten: { unsicher: unsicher.unten },
    oben: { unsicher: unsicher.oben },
  }
  GELESEN.forEach(([grenze, angabe], index) => {
    angaben[grenze][angabe] = werte[index]
  })
  const alle = lagen(angaben)
  const weit = ferne(alle)

  if (alle.length === 0 && !begruendung?.trim()) return null

  const grenzwort = (grenze: Grenze) =>
    t(grenze === 'unten' ? 'protokoll.karte.untereGrenze' : 'protokoll.karte.obereGrenze')
  const ohneName = (lage: Lage) => PLATZHALTER.test(lage.name)
  const werteFuer = (lage: Lage) => ({
    grenze: grenzwort(lage.grenze),
    abstand: entfernungText(lage.abstand, sprache),
    name: lage.name,
  })
  const aufsWasser = (lage: Lage) => {
    const optionen = { shouldDirty: true, shouldTouch: true, shouldValidate: true }
    setValue(GESETZT[lage.grenze].rw, lage.rw, optionen)
    setValue(GESETZT[lage.grenze].hw, lage.hw, optionen)
  }

  return (
    <div className="einrastanzeige">
      <Typography id={titelId} variant="subtitle2" component="p">
        {t('protokoll.karte.amWasserTitel')}
      </Typography>
      <Typography variant="body2" className="form-section__hint">
        {t(
          nurLesen ? 'protokoll.karte.amWasserHinweisNurLesen' : 'protokoll.karte.amWasserHinweis',
        )}
      </Typography>
      <List disablePadding aria-labelledby={titelId} className="einrastanzeige__lagen">
        {alle.map((lage) => (
          <ListItem
            key={lage.grenze}
            disableGutters
            disablePadding
            className="einrastanzeige__lage"
          >
            <span>
              {t(
                ohneName(lage) ? 'protokoll.karte.abstandOhneName' : 'protokoll.karte.abstand',
                werteFuer(lage),
              )}
            </span>
            {!nurLesen && lage.abstand > 0 && (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => aufsWasser(lage)}
              >
                {t('protokoll.karte.aufsWasser', { grenze: grenzwort(lage.grenze) })}
              </Button>
            )}
          </ListItem>
        ))}
      </List>

      {weit.length > 0 && (
        <Alert severity="warning">
          {weit.map((lage) => (
            <Typography key={lage.grenze} variant="inherit" gutterBottom>
              {t(
                ohneName(lage) ? 'protokoll.karte.fernOhneName' : 'protokoll.karte.fern',
                werteFuer(lage),
              )}
            </Typography>
          ))}
          {!nurLesen && (
            <Typography variant="inherit">{t('protokoll.karte.fernHinweis')}</Typography>
          )}
        </Alert>
      )}

      {(weit.length > 0 || begruendung?.trim()) && (
        <div className="grid">
          <FeldText
            name={BEGRUENDUNG.pfad}
            labelKey={BEGRUENDUNG.labelKey}
            hinweisKey="protokoll.abschnitt1.probestrecke.feld.abstandBegruendungHinweis"
            spalten={12}
            zeilen={2}
          />
        </div>
      )}
    </div>
  )
}

export default Einrastanzeige
