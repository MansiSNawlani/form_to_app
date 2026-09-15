import { describe, expect, it } from 'vitest'
/* Vite's ?raw import rather than node:fs. The app's TypeScript project is typed
   against vite/client and not against node, so reading the file with fs would
   mean adding @types/node to the whole app for one test. */
import quelle from './ProtokollNurLesen.tsx?raw'

/* A guard over the source rather than over the rendering.
 *
 * Unusual, and deliberate. coding-standards.md says not to unit test components,
 * and the frontend suite runs in a node environment with no DOM, so rendering
 * this page in a test would mean adding jsdom for one assertion. What is being
 * guarded is not how the page looks: it is which hooks it is allowed to mount,
 * which is a fact about the file and can be read off the file.
 *
 * The danger it guards is quiet and expensive. useHydrologieAbgleich runs on its
 * own, without anybody typing, and it DELETES the hydrology answers whenever the
 * Gewaessertyp says they do not apply. On a draft that is correct. On this page
 * it would mean that opening a protocol to read it rewrites what somebody filed
 * months ago, with no action by the reader and nothing on screen to show it
 * happened.
 *
 * It is not hypothetical. Feature 23 imports protocols out of the legacy Acrobat
 * form, whose own version of that check tests for Gewaessertyp 31 and 32, codes
 * that do not exist (defect 9 in docs/ffs-defect-list.md). It therefore never
 * clears anything, so imported protocols will arrive carrying a standing-water
 * type together with a full set of flowing-water answers: exactly the shape this
 * hook would erase on sight.
 *
 * The obvious future mistake is somebody noticing that section 2 behaves
 * differently here and "fixing" it by mounting the hook. This is what stops that
 * reaching a reviewer's screen.
 */

/* Hooks that write, and what each would do to a protocol that has been filed.
   The comment matters as much as the name: whoever hits this failure needs to
   know why the rule exists before deciding what to do about it. */
const VERBOTEN = [
  ['useHydrologieAbgleich', 'deletes the hydrology answers of a standing water'],
  ['useAutoSave', 'writes the answers back to the server'],
  ['useAbsenden', 'submits the protocol'],
] as const

describe('ProtokollNurLesen', () => {
  it.each(VERBOTEN)('mountet %s nicht, weil es %s', (hook) => {
    expect(quelle).not.toContain(`${hook}(`)
  })

  it('übergibt keinen Resolver, damit keine Regel auf einem eingereichten Protokoll läuft', () => {
    // A reviewer judging a filed protocol is not being asked to correct it, and
    // the gate deciding whether it could be submitted at all already ran at
    // Absenden. Red messages here would be the application arguing with a record.
    expect(quelle).toContain('useForm<Antworten>({ defaultValues: antworten })')
    /* The code shapes, not the words. The file explains in prose why it mounts
       no resolver and never triggers, and a guard matching bare words would fail
       on its own explanation. */
    expect(quelle).not.toContain('resolver:')
    expect(quelle).not.toContain('trigger(')
  })
})
