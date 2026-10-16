import Autocomplete from '@mui/material/Autocomplete'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useQuery } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { feldAria, type FeldRahmenProps } from './rahmen'
import Feldwert from '../nurlesen/Feldwert'
import { useNurLesen } from '../nurlesen/kontext'
import { gewaessersucheAbfrage, suchbar, type Gewaessertreffer } from '../gewaessernetz/api'
import {
  KENNUNG_LEEREN,
  KENNUNG_PFAD,
  NAME_PFAD,
  VERSION_PFAD,
  entfernungText,
  kennungBleibt,
  kettenHinweis,
  suchpunkte,
  unterzeile,
  wahlSchreibt,
  type Eintraege,
  type KettenHinweis,
} from '../gewaessernetz/auswahl'
import { VORFLUTER_PFADE } from '../regeln/vorfluter'
import type { Antworten, AntwortPfad } from '../entwurf/typen'
import { useLocale } from '../../i18n/useLocale'

/* The Gewaesser name, searched against LUBW's official network as it is typed.
 *
 * A text box first and a search second. Whatever is typed is the answer, as it
 * always was; the list underneath only offers the official spelling, and picking
 * from it also fills in the identifier and the release (feature 18c). A water
 * the network does not hold is simply typed and filed without an identifier, so
 * a failed search or an empty network leaves an ordinary text box, never a dead
 * one.
 */

// Long enough that typing "Mühlbach" sends one request, not eight.
const VERZOEGERUNG_MS = 250

const SUCHE = 'protokoll.abschnitt1.probestrecke.gewaessersuche'

/** An answer shown read-only under the field, and what to call it. */
interface Zusatz<P extends AntwortPfad> {
  pfad: P
  labelKey: ParseKeys
}

interface GewaessersucheProps extends Omit<FeldRahmenProps, 'id'> {
  name: typeof NAME_PFAD
  kennung: Zusatz<typeof KENNUNG_PFAD>
  stand: Zusatz<typeof VERSION_PFAD>
}

function Gewaessersuche({
  name,
  labelKey,
  spalten,
  pflicht,
  hinweisKey,
  kennung,
  stand,
}: GewaessersucheProps) {
  const { t } = useTranslation()
  const { control, getValues, setValue, trigger } = useFormContext<Antworten>()
  const sprache = useLocale()
  const fehlerKey = useFeldFehler(name)
  const nurLesen = useNurLesen()

  const [offen, setOffen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const gesucht = useVerzoegert(eingabe, VERZOEGERUNG_MS)
  /* Read on each render rather than watched: this field re-renders as it is
     typed into, which is the only moment the points matter, and a subscription
     would re-render it on every keystroke in the coordinate boxes too. */
  const punkte = suchpunkte(getValues('probestrecke'))
  const suche = useQuery(gewaessersucheAbfrage(gesucht, punkte, offen))

  // Why the last pick left the Vorfluter boxes alone, until the name is typed over.
  const [kette, setKette] = useState<KettenHinweis | null>(null)

  /* The name the current identifier was picked with. Held for this visit only:
     after a reload it is unknown, and the first change to the box then clears
     the identifier, which is the safe direction to be wrong in. */
  const gewaehlt = useRef<string | undefined>(undefined)

  /* Two answers that change only when a water is picked or the name typed over,
     so watching them costs nothing while somebody types elsewhere. */
  const [amtlicheId, version] = useWatch<Antworten>({
    name: [kennung.pfad, stand.pfad],
  }) as readonly (string | undefined)[]
  const kennungId = `${name}-kennung`
  const kennungszeile = amtlicheId ? (
    <p className="gewaessersuche__kennung" id={kennungId}>
      {t(kennung.labelKey)}: {amtlicheId}
      {version ? ` (${version})` : ''}
    </p>
  ) : null

  if (nurLesen) {
    return (
      <FeldRahmen
        id={name}
        labelKey={labelKey}
        spalten={spalten}
        pflicht={pflicht}
        hinweisKey={hinweisKey}
      >
        <Feldwert wert={getValues(name)} />
        {kennungszeile}
      </FeldRahmen>
    )
  }

  const beschreibe = (treffer: Gewaessertreffer): string => {
    const zeile = unterzeile(treffer)
    return zeile.art === 'fliesstIn'
      ? t(`${SUCHE}.fliesstIn`, { name: zeile.name })
      : t(`${SUCHE}.${zeile.art}`)
  }

  const schreibe = (eintraege: Eintraege) => {
    for (const [pfad, wert] of eintraege) {
      setValue(pfad, wert, { shouldDirty: true, shouldValidate: true })
    }
  }

  const getippt = (text: string) => {
    if (getValues(KENNUNG_PFAD) && !kennungBleibt(text, gewaehlt.current)) {
      gewaehlt.current = undefined
      schreibe(KENNUNG_LEEREN)
    }
    setKette(null)
  }

  /* Said under the field once a search has shown it cannot help: nothing loaded
     on the server, or the request failed. Typing still works either way. */
  const nichtVerfuegbar = suche.isError || (suche.data !== undefined && suche.data.stand === null)
  const hinweis: ParseKeys | undefined = nichtVerfuegbar
    ? `${SUCHE}.nichtVerfuegbar`
    : kette === 'zuLang'
      ? `${SUCHE}.ketteZuLang`
      : kette === 'stehend'
        ? `${SUCHE}.ketteStehend`
        : hinweisKey
  const treffer = nichtVerfuegbar ? [] : (suche.data?.treffer ?? [])

  return (
    <FeldRahmen
      id={name}
      labelFuer={name}
      labelKey={labelKey}
      spalten={spalten}
      pflicht={pflicht}
      hinweisKey={hinweis}
      fehlerKey={fehlerKey}
    >
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Autocomplete<Gewaessertreffer, false, false, true>
            id={name}
            freeSolo
            options={treffer}
            /* The server has already filtered; filtering again here would drop
               "Mühlbach" for somebody who typed "Muehlb". */
            filterOptions={(alle) => alle}
            open={offen && suchbar(gesucht) && !nichtVerfuegbar}
            onOpen={() => setOffen(true)}
            onClose={() => setOffen(false)}
            loading={suche.isFetching}
            loadingText={t(`${SUCHE}.laedt`)}
            noOptionsText={t(`${SUCHE}.keinTreffer`)}
            value={field.value ?? ''}
            inputValue={field.value ?? ''}
            onInputChange={(_, text, grund) => {
              // "reset" is MUI writing back the label of what was just picked.
              if (grund !== 'input') return
              field.onChange(text)
              setEingabe(text)
              getippt(text)
            }}
            onChange={(_, gewaehlterTreffer) => {
              if (gewaehlterTreffer === null || typeof gewaehlterTreffer === 'string') return
              const stand = suche.data?.stand
              if (!stand) return
              gewaehlt.current = gewaehlterTreffer.name
              schreibe(wahlSchreibt(gewaehlterTreffer, stand))
              setKette(kettenHinweis(gewaehlterTreffer))
              /* The chain rule reads all five boxes together, and each box above
                 was checked while the others still held the old chain. */
              void trigger([...VORFLUTER_PFADE])
            }}
            onBlur={field.onBlur}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
            getOptionKey={(option) => (typeof option === 'string' ? option : option.kennung)}
            isOptionEqualToValue={(option, wert) =>
              typeof wert !== 'string' && option.kennung === wert.kennung
            }
            renderOption={({ key, ...props }, option) => (
              <li key={key} {...props}>
                <span className="gewaessersuche__treffer">
                  <span>{option.name}</span>
                  <span className="gewaessersuche__vorfluter">
                    {beschreibe(option)}
                    {option.entfernung_m !== null &&
                      `, ${t(`${SUCHE}.entfernt`, { entfernung: entfernungText(option.entfernung_m, sprache) })}`}
                  </span>
                </span>
              </li>
            )}
            renderInput={({ slotProps }) => {
              const aria = feldAria(name, pflicht, hinweis, fehlerKey)
              // The identifier is read out with the field, as part of what it holds.
              const beschrieben = [aria['aria-describedby'], kennungszeile && kennungId]
                .filter(Boolean)
                .join(' ')
              return (
                <OutlinedInput
                  {...slotProps.input}
                  inputProps={{
                    ...slotProps.htmlInput,
                    ...aria,
                    'aria-describedby': beschrieben || undefined,
                  }}
                  fullWidth
                />
              )
            }}
          />
        )}
      />
      {kennungszeile}
    </FeldRahmen>
  )
}

/** The value as it was a moment ago, once it has stopped changing. */
function useVerzoegert(wert: string, ms: number): string {
  const [verzoegert, setVerzoegert] = useState(wert)
  useEffect(() => {
    const zeitgeber = setTimeout(() => setVerzoegert(wert), ms)
    return () => clearTimeout(zeitgeber)
  }, [wert, ms])
  return verzoegert
}

export default Gewaessersuche
