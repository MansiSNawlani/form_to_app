import { useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
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
 * Watching the type alone, and reading the rest with getValues, means this runs
 * when the type changes and once on opening a draft, rather than on every
 * keystroke anywhere in the document.
 */
export function useHydrologieAbgleich(form: UseFormReturn<Antworten>) {
  const { control, getValues, setValue, trigger } = form
  const gewaessertyp = useWatch<Antworten, 'probestrecke.gewaessertyp'>({
    control,
    name: 'probestrecke.gewaessertyp',
  })

  useEffect(() => {
    const angleichungen = hydrologieAngleichen(getValues())
    if (angleichungen.length === 0) return

    for (const { pfad, wert } of angleichungen) {
      /* Dirty so the automatic save takes it, untouched so nine groups do not
         turn red the moment somebody picks See. */
      setValue(pfad, wert, { shouldDirty: true, shouldTouch: false })
    }

    /* An answer that was wrong is not wrong any more once the section stops
       applying, and nothing else would recheck it. Without this a red message
       stays behind on a field nobody can see. */
    void trigger(HYDROLOGIE_PFADE)
  }, [gewaessertyp, getValues, setValue, trigger])
}
