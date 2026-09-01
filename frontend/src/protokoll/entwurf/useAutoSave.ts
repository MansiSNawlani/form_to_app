import { useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { entwurfStore } from './store'
import type { Antworten, Entwurf } from './typen'

/* Saving is automatic and its state is always visible, which project-overview.md
 * makes a requirement rather than a nicety: the protocol is long, it is filled in
 * over several sittings, and a surveyor has to be able to close the laptop
 * mid-section and trust that the work is there tomorrow. */

/* A union rather than a status beside a nullable timestamp, so "saved" always
   carries the moment it was saved and the indicator has no absent case to invent
   a value for. */
export type SaveState =
  | { status: 'unchanged' }
  | { status: 'saving' }
  | { status: 'saved'; zeitpunkt: string }
  | { status: 'failed' }

/* Long enough that typing a word is one save and not eight, short enough that
   nobody navigates away in the gap. The unmount flush covers that gap anyway. */
const DEBOUNCE_MS = 800

export function useAutoSave(
  entwurf: Entwurf,
  form: UseFormReturn<Antworten>,
): SaveState {
  const [state, setState] = useState<SaveState>({ status: 'unchanged' })

  /* The envelope as last written. Kept in a ref rather than in state because
     saving must not re-render the form, and because the flush on unmount has to
     see the current value rather than the one captured when the effect ran. */
  const letzterEntwurf = useRef(entwurf)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false

    function save(report: boolean) {
      if (!pending) return
      pending = false
      const result = entwurfStore.writeEntwurf({
        ...letzterEntwurf.current,
        antworten: form.getValues(),
      })
      letzterEntwurf.current = result.entwurf
      if (!report) return
      setState(
        result.status === 'saved'
          ? { status: 'saved', zeitpunkt: result.entwurf.geaendertAm }
          : { status: 'failed' },
      )
    }

    const subscription = form.watch(() => {
      pending = true
      setState({ status: 'saving' })
      clearTimeout(timer)
      timer = setTimeout(() => save(true), DEBOUNCE_MS)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
      /* Leaving the page inside the debounce window must not lose the last
         change. Reporting state on the way out would be a write to a component
         that is going away, so this flush is silent. */
      save(false)
    }
  }, [form])

  return state
}
