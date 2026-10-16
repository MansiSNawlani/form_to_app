import Autocomplete from '@mui/material/Autocomplete'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useQuery } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import FeldRahmen from './FeldRahmen'
import { useFeldFehler } from './fehler'
import { feldAria, type FeldRahmenProps } from './rahmen'
import Feldwert from '../nurlesen/Feldwert'
import { useNurLesen } from '../nurlesen/kontext'
import { gewaessersucheAbfrage, type Gewaessertreffer } from '../gewaessernetz/api'
import {
  KENNUNG_LEEREN,
  KENNUNG_PFAD,
  kennungBleibt,
  wahlSchreibt,
  type Eintraege,
} from '../gewaessernetz/auswahl'
import type { Antworten } from '../entwurf/typen'

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

interface GewaessersucheProps extends Omit<FeldRahmenProps, 'id'> {
  name: 'probestrecke.gewaesser.gewaessername'
}

function Gewaessersuche({ name, labelKey, spalten, pflicht, hinweisKey }: GewaessersucheProps) {
  const { t } = useTranslation()
  const { control, getValues, setValue } = useFormContext<Antworten>()
  const fehlerKey = useFeldFehler(name)
  const nurLesen = useNurLesen()

  const [offen, setOffen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const gesucht = useVerzoegert(eingabe, VERZOEGERUNG_MS)
  const suche = useQuery({ ...gewaessersucheAbfrage(gesucht), enabled: offen && gesucht.trim().length >= 2 })

  /* The name the current identifier was picked with. Held for this visit only:
     after a reload it is unknown, and the first change to the box then clears
     the identifier, which is the safe direction to be wrong in. */
  const gewaehlt = useRef<string | undefined>(undefined)

  if (nurLesen) {
    return (
      <FeldRahmen id={name} labelKey={labelKey} spalten={spalten} pflicht={pflicht} hinweisKey={hinweisKey}>
        <Feldwert wert={getValues(name)} />
      </FeldRahmen>
    )
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
  }

  /* Said under the field once a search has shown it cannot help: nothing loaded
     on the server, or the request failed. Typing still works either way. */
  const nichtVerfuegbar = suche.isError || (suche.data !== undefined && suche.data.stand === null)
  const hinweis: ParseKeys | undefined = nichtVerfuegbar ? `${SUCHE}.nichtVerfuegbar` : hinweisKey
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
            open={offen && gesucht.trim().length >= 2 && !nichtVerfuegbar}
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
                    {option.vorfluter_name === null
                      ? t(`${SUCHE}.stehend`)
                      : t(`${SUCHE}.fliesstIn`, { name: option.vorfluter_name })}
                  </span>
                </span>
              </li>
            )}
            renderInput={({ slotProps }) => (
              <OutlinedInput
                {...slotProps.input}
                inputProps={{ ...slotProps.htmlInput, ...feldAria(name, pflicht, hinweis, fehlerKey) }}
                fullWidth
              />
            )}
          />
        )}
      />
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
