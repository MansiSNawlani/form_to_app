import { z } from 'zod'
import { pruefeKoordinaten } from './koordinaten'
import { pruefeMonitoringnummer } from './monitoring'
import { pruefeVorfluterkette } from './vorfluter'
import type { Regel } from './regel'
import type { Antworten } from '../entwurf/typen'

/* The one place that knows about both the rules and the field paths.
 *
 * No rule logic lives here and no schema lives in a component: this only walks
 * the rules and hangs each translation key they return on the path it belongs
 * to, which is what React Hook Form needs to show a message under the right
 * field. Parts 2 to 6 add their rules to the list below.
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
]

export const antwortenSchema = z
  .custom<Antworten>()
  .superRefine((antworten, ctx) => {
    for (const regel of REGELN) {
      for (const { pfad, schluessel } of regel(antworten)) {
        ctx.addIssue({
          code: 'custom',
          path: pfad.split('.'),
          // The key, not a sentence. FeldRahmen translates it.
          message: schluessel,
        })
      }
    }
  })
