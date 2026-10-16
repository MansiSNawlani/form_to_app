import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Locale } from '../../i18n/sprachen'
import type { Antworten } from '../entwurf/typen'
import FeldText from '../felder/FeldText'
import { entfernungText } from '../gewaessernetz/auswahl'
import { useNurLesen } from '../nurlesen/kontext'
import { abstandM, istFern } from '../regeln/abstand'
import { BEGRUENDUNG, EINGERASTET, GRENZEN } from './einrasten'
import type { Grenze } from './Grenzwahl'
import { gueltigerPunkt } from './umrechnung'

const GELESEN = GRENZEN.flatMap((grenze) => [
  `probestrecke.utm_rw_${grenze}` as const,
  `probestrecke.utm_hw_${grenze}` as const,
  EINGERASTET[grenze].rw.pfad,
  EINGERASTET[grenze].hw.pfad,
  EINGERASTET[grenze].name.pfad,
])

// LUBW's placeholder for a water without a name, NN-YBP and the like.
const PLATZHALTER = /^NN-/

interface Lage {
  grenze: Grenze
  rw: string
  hw: string
  name: string
  abstand: number
}

/* Under the map: for each boundary point, which water it lies by and how far,
   a button that moves the typed point onto the water, and when a point is far
   a warning and the box for the reason the submit then asks for.

   Read from the stored answers, so the review screen shows what was filed and
   a draft shows what useEinrasten last wrote. Nothing shows for a point with no
   position on the water: no valid coordinates, no network loaded, or a failed
   request, in which case the map works exactly as it did before 18d. */
function Einrastanzeige() {
  const { t, i18n } = useTranslation()
  const nurLesen = useNurLesen()
  const { setValue } = useFormContext<Antworten>()
  const werte = useWatch<Antworten>({ name: GELESEN }) as readonly (string | undefined)[]
  const begruendung = useWatch<Antworten>({ name: BEGRUENDUNG.pfad }) as string | undefined
  const sprache = i18n.language as Locale

  const lagen = GRENZEN.flatMap((grenze, index): Lage[] => {
    const [rwTyp, hwTyp, rw, hw, name] = werte.slice(index * 5, index * 5 + 5)
    const gesetzt = gueltigerPunkt(rwTyp, hwTyp)
    const amWasser = gueltigerPunkt(rw, hw)
    if (!gesetzt || !amWasser || !rw || !hw) return []
    return [{ grenze, rw, hw, name: name ?? '', abstand: abstandM(gesetzt, amWasser) }]
  })
  const ferne = lagen.filter((lage) => istFern(lage.abstand))

  if (lagen.length === 0 && !begruendung?.trim()) return null

  const grenzwort = (grenze: Grenze) =>
    t(grenze === 'unten' ? 'protokoll.karte.untereGrenze' : 'protokoll.karte.obereGrenze')
  const aufsWasser = (lage: Lage) => {
    const optionen = { shouldDirty: true, shouldTouch: true, shouldValidate: true }
    setValue(`probestrecke.utm_rw_${lage.grenze}`, lage.rw, optionen)
    setValue(`probestrecke.utm_hw_${lage.grenze}`, lage.hw, optionen)
  }

  return (
    <div className="einrastanzeige">
      <p className="einrastanzeige__titel">{t('protokoll.karte.amWasserTitel')}</p>
      <p className="form-section__hint">
        {t(nurLesen ? 'protokoll.karte.amWasserHinweisNurLesen' : 'protokoll.karte.amWasserHinweis')}
      </p>
      <ul className="einrastanzeige__lagen">
        {lagen.map((lage) => (
          <li key={lage.grenze}>
            <span>
              {PLATZHALTER.test(lage.name)
                ? t('protokoll.karte.abstandOhneName', {
                    grenze: grenzwort(lage.grenze),
                    abstand: entfernungText(lage.abstand, sprache),
                  })
                : t('protokoll.karte.abstand', {
                    grenze: grenzwort(lage.grenze),
                    abstand: entfernungText(lage.abstand, sprache),
                    name: lage.name,
                  })}
            </span>
            {!nurLesen && lage.abstand > 0 && (
              <Button type="button" variant="outlined" size="small" onClick={() => aufsWasser(lage)}>
                {t('protokoll.karte.aufsWasser', { grenze: grenzwort(lage.grenze) })}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {ferne.length > 0 && (
        <Alert severity="warning">
          {ferne.map((lage) => (
            <p key={lage.grenze}>
              {t('protokoll.karte.fern', {
                grenze: grenzwort(lage.grenze),
                abstand: entfernungText(lage.abstand, sprache),
              })}
            </p>
          ))}
          {!nurLesen && <p>{t('protokoll.karte.fernHinweis')}</p>}
        </Alert>
      )}

      {(ferne.length > 0 || begruendung?.trim()) && (
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
