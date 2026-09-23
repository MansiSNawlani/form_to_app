/* What the import left behind for this protocol, read once on the way in.
 *
 * Read lazily and held in state rather than read on every render, the same
 * arrangement useAbsenden uses for the remembered refusal: reaching for storage
 * is not free, and this sits above a form of roughly 338 fields where anything
 * on the render path is on the keystroke path.
 *
 * Null for every protocol nobody imported, which is nearly all of them, and for
 * an import that had nothing to report.
 */

import { useCallback, useState } from 'react'
import { berichtstore, type GemerkterBericht } from './bericht'

export interface Einlesebefund {
  bericht: GemerkterBericht | null
  /* The field paths, pulled out because that is what the panel and the step bar
     want and neither should have to know the report's shape. A stable empty
     array when there is no report, so nothing downstream has to ask first and
     no new array is made per render. */
  unbrauchbarePfade: readonly string[]
  /** Dismiss the banner. The unusable answers and the pictures stay. */
  bannerGelesen: () => void
}

const KEINE: readonly string[] = []

export function useEinlesebericht(entwurfId: string): Einlesebefund {
  const [bericht, setBericht] = useState(() => berichtstore.lies(entwurfId))

  const bannerGelesen = useCallback(() => {
    berichtstore.bannerGelesen(entwurfId)
    /* Updated here as well as in storage, so the banner goes at the click rather
       than at the next reload. Nothing else in the report changes: an unreadable
       date stays unreadable and a missing photograph stays missing. */
    setBericht((vorher) => (vorher === null ? null : { ...vorher, bannerGelesen: true }))
  }, [entwurfId])

  return {
    bericht,
    unbrauchbarePfade: bericht?.unbrauchbar ?? KEINE,
    bannerGelesen,
  }
}
