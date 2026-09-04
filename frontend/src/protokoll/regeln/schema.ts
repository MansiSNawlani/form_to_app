import { z } from 'zod'
import { pruefeEinfluesse } from './einfluesse'
import { pruefeKoordinaten } from './koordinaten'
import { pruefeMonitoringnummer } from './monitoring'
import { pruefeProzentgruppen } from './prozent'
import { pruefeSchaetzwerte } from './schaetzwert'
import { pruefeVorfluterkette } from './vorfluter'
import type { Regel } from './regel'
import type { Antworten } from '../entwurf/typen'

/* The one place that knows about both the rules and the field paths. Parts 2 to
 * 6 add their rules to the list below.
 *
 * z.custom rather than a described object, because this validates a document
 * whose shape TypeScript already guarantees and whose keys must survive
 * untouched. A z.object would strip every key it was not told about, which for
 * a half-finished draft would mean quietly dropping answers.
 */

const REGELN: Regel[] = [
  pruefeMonitoringnummer,
  pruefeVorfluterkette,
  pruefeKoordinaten,
  pruefeSchaetzwerte,
  pruefeProzentgruppen,
  pruefeEinfluesse,
]

export const antwortenSchema = z
  .custom<Antworten>()
  .superRefine((antworten, ctx) => {
    for (const regel of REGELN) {
      for (const { pfad, schluessel } of regel(antworten)) {
        ctx.addIssue({ code: 'custom', path: pfad.split('.'), message: schluessel })
      }
    }
  })
