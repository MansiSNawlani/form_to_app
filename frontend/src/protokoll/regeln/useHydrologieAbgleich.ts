import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { HYDROLOGIE_PFADE, hydrologieAngleichen } from './hydrologie'
import type { Antworten } from '../entwurf/typen'

/* Keeps the Hydrologie answers in step with the chosen Gewaessertyp.
 *
 * Called from ProtokollFormular rather than from the section, because the
 * Gewaessertyp is answered in section 1 and section 2 may never be opened. A
 * hook living inside the block would leave a protocol saying "See" while its
 * hydrology answers still described a river, which is the condition defect 9 in
 * docs/ffs-defect-list.md complains about.
 *
 * Handed the form rather than reaching for useFormContext, the same way
 * useAutoSave is: this runs in the component that provides the context, where
 * there is no context to read yet.
 *
 * Subscribed rather than watched, for the same reason useNachpruefung is, and
 * it matters more here than anywhere else: this hook sits in the component that
 * renders the whole page, so a useWatch would re-render the header, the step bar
 * and every field in the open section each time the Gewaessertyp changed. That
 * happens while MUI's dropdown is still animating shut, and a menu whose anchor
 * re-renders underneath it flickers and can land a click on the wrong option.
 * A subscription sees the same changes and re-renders nothing.
 */

const GEWAESSERTYP = 'probestrecke.gewaessertyp'

export function useHydrologieAbgleich(form: UseFormReturn<Antworten>) {
  useEffect(() => {
    function angleichen() {
      const angleichungen = hydrologieAngleichen(form.getValues())
      if (angleichungen.length === 0) return

      for (const { pfad, wert } of angleichungen) {
        /* Dirty so the automatic save takes it, untouched so nine groups do not
           turn red the moment somebody picks See. */
        form.setValue(pfad, wert, { shouldDirty: true, shouldTouch: false })
      }

      /* An answer that was wrong is not wrong any more once the section stops
         applying, and nothing else would recheck it. Without this a red message
         stays behind on a field nobody can see. */
      void form.trigger(HYDROLOGIE_PFADE)
    }

    /* Unlike useNachpruefung, this does fire on mount: a draft put down as a
       standing water has to be picked up as one, and a draft saved before this
       rule existed carries whatever the old form left in it. */
    angleichen()

    const subscription = form.watch((_, { name }) => {
      // Only the type. The writes below are all under hydrologie, so this
      // cannot answer its own change.
      if (name === GEWAESSERTYP) angleichen()
    })
    return () => subscription.unsubscribe()
  }, [form])
}
