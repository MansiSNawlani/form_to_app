/* Which of the refused answers somebody has since put something into.
 *
 * Written once and used twice, by the panel that lists a section's problems and
 * by the step bar that counts them, so the two can never disagree about what
 * counts as dealt with.
 *
 * **Each caller subscribes for itself, deliberately.** Lifting this into
 * ProtokollFormular would mean one subscription instead of two, and would also
 * re-render the open section on every keystroke in a listed field: on the catch
 * table that is the 206ms redraw useAutoSave's own comment records. Both callers
 * here are siblings of the section rather than ancestors of it, so their
 * re-renders stay inside a step bar and a short list.
 *
 * The subscription is by path rather than a bare watch(), which would fire on all
 * 338 answers rather than on the handful actually listed.
 */

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { Antworten } from '../entwurf/typen'
import type { Verstoss } from '../../api/typen'

/* Problems that name a block rather than a field: a percentage run, a tick
 * group, a fished area, the catch table as a whole. None can be ticked off by
 * looking at one box, so they are never watched and never counted as done.
 */
export function istSammelpfad(pfad: string): boolean {
  return (
    pfad.startsWith('summe.') ||
    pfad.startsWith('block.') ||
    pfad.startsWith('bereich.') ||
    pfad.startsWith('widerspruch.') ||
    pfad.startsWith('paar.') ||
    pfad.startsWith('tabelle.')
  )
}

export function useErledigtePfade(verstoesse: readonly Verstoss[]): ReadonlySet<string> {
  const { control } = useFormContext<Antworten>()

  const feldpfade = useMemo(
    () => verstoesse.map((verstoss) => verstoss.pfad).filter((pfad) => !istSammelpfad(pfad)),
    [verstoesse],
  )

  const werte = useWatch({ control, name: feldpfade as never })

  return useMemo(() => {
    const gefuellt = new Set<string>()
    const gelesen: unknown[] = Array.isArray(werte) ? werte : []
    feldpfade.forEach((pfad, index) => {
      const wert = gelesen[index]
      /* Filled in, not correct. The browser can see a box is no longer empty;
         whether the value is right is the server's to say, because the rules live
         there. */
      if (typeof wert === 'string' && wert.trim() !== '') gefuellt.add(pfad)
    })
    return gefuellt
  }, [feldpfade, werte])
}
