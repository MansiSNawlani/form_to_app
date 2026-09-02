import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* Rechecks other fields when one field changes.
 *
 * React Hook Form only rechecks the field being edited, so a rule spanning two
 * answers goes stale: choosing WRRL would not raise a message on the
 * Monitoringstrecken-Nr., and typing "Rhein" into the second Vorfluter box
 * would not settle the first. Parts 2 to 6 have about forty more rules of that
 * kind.
 *
 * Subscribed rather than watched into the render, so a keystroke re-renders the
 * field and not the block around it, and nothing fires on mount: reopening a
 * half-finished draft stays quiet.
 *
 * Both arguments must be stable across renders, so declare them outside the
 * component. An inline array or arrow resubscribes on every render.
 */
export function useNachpruefung(
  loestAus: readonly AntwortPfad[],
  zuPruefen: (geaendert: AntwortPfad) => readonly AntwortPfad[],
) {
  const { trigger, watch } = useFormContext<Antworten>()

  useEffect(() => {
    const subscription = watch((_, { name }) => {
      // find rather than includes: it hands back the path already narrowed to
      // one of ours, where React Hook Form's own name is the wider union of
      // every path in the document, groups included.
      const geaendert = loestAus.find((pfad) => pfad === name)
      if (!geaendert) return
      void trigger(zuPruefen(geaendert))
    })
    return () => subscription.unsubscribe()
  }, [watch, trigger, loestAus, zuPruefen])
}
