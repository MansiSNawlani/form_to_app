import type { Option } from '../../optionen'

/* The scale the Strukturen are rated on, transcribed from the line printed
 * above the block on page 2 of the form:
 *
 *   Semiquantitative Angaben: 0 = keine  1 = wenig  2 = verbreitet  3 = dominierend
 *
 * Declared here rather than in optionslisten.json because the legacy form stores
 * these eight answers as free text. There are no export values in the PDF to
 * pair these words against, so the seed file has nothing to say about them. See
 * Optionsquelle in optionen.ts.
 *
 * The number is stored and the word is shown beside it, the same pairing the
 * Gewaessertyp uses. On its own "2" answers nothing, and the scale is printed
 * once at the top of the block in the legacy form, which is no help at all to
 * someone tabbing through eight ratings.
 *
 * German rather than a translation key, because every other option label in the
 * app comes untranslated out of the seed file. Feature 17 has to decide what to
 * do about option labels as a whole; one hand-written list should not get there
 * ahead of the other twenty-two.
 *
 * This narrows what the legacy form accepts. Its text boxes take 7, -1 or a
 * sentence, and check none of it. Four buttons make all of that impossible
 * without any rule being written.
 */
export const STRUKTURSTUFEN: readonly Option[] = [
  { wert: '0', label: '0 - keine' },
  { wert: '1', label: '1 - wenig' },
  { wert: '2', label: '2 - verbreitet' },
  { wert: '3', label: '3 - dominierend' },
]
