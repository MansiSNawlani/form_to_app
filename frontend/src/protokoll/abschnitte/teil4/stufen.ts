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
 * Only the stored numbers are declared here. The words are in the locale files
 * under protokoll.abschnitt4.strukturen.stufe, from feature 17d, since unlike the
 * seed lists they have no other source to stay in step with. StrukturenBlock
 * puts the two together.
 *
 * The number is stored and the word is shown beside it, the same pairing the
 * Gewaessertyp uses. On its own "2" answers nothing, and the scale is printed
 * once at the top of the block in the legacy form, which is no help at all to
 * someone tabbing through eight ratings.
 *
 * This narrows what the legacy form accepts. Its text boxes take 7, -1 or a
 * sentence, and check none of it. Four buttons make all of that impossible
 * without any rule being written.
 */
export const STRUKTURSTUFEN = ['0', '1', '2', '3'] as const
