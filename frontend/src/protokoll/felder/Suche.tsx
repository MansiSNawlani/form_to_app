import { Controller, useFormContext } from 'react-hook-form'
import Optionssuche, { type EingabeAria } from './Optionssuche'
import type { ListenName } from '../optionen'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The option search, bound to one answer in the draft.
 *
 * Two callers, and they name it in incompatible ways. FeldSuche wraps it in a
 * FeldRahmen, which draws a visible label above the control, the shape every
 * ordinary field on the protocol has. Part 6's ArtZelle puts it in a table cell,
 * where the name comes from the column heading and a label drawn above would be
 * repeated twenty-six times down the grid. Both are the same control, which is
 * why it lives in Optionssuche.tsx.
 *
 * What this file is, and all it is: that control wired to react-hook-form. An
 * empty choice is stored as "" rather than null, because every answer in the
 * draft is a string and a null would be a second way of saying the same thing.
 *
 * Split in two during feature 12c, when the review queue needed the same control
 * in a filter bar with no form around it.
 */

export type { EingabeAria } from './Optionssuche'

interface SucheProps {
  /** The legacy PDF field path, which is also the control's id. */
  name: AntwortPfad
  liste: ListenName
  eingabeAria: EingabeAria
  className?: string
  fehlerhaft?: boolean
}

function Suche({ name, liste, eingabeAria, className, fehlerhaft }: SucheProps) {
  const { control } = useFormContext<Antworten>()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Optionssuche
          id={name}
          liste={liste}
          wert={field.value ?? null}
          onWaehlen={(wert) => field.onChange(wert ?? '')}
          onBlur={field.onBlur}
          eingabeAria={eingabeAria}
          className={className}
          fehlerhaft={fehlerhaft}
        />
      )}
    />
  )
}

export default Suche
