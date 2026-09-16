import type { ComponentType } from 'react'
import Abschnitt1 from './Abschnitt1'
import Abschnitt2 from './Abschnitt2'
import Abschnitt3 from './Abschnitt3'
import Abschnitt4 from './Abschnitt4'
import Abschnitt5 from './Abschnitt5'
import Abschnitt6 from './Abschnitt6'
import type { Abschnitt } from '../abschnitte'

/* The six sections of the printed form, which need nothing but the form context.
 *
 * Section 7 is deliberately absent. The attachments are not part of the answers
 * document and their block needs a protocol id and an uploader, so it is passed
 * its own props wherever it is drawn; it is also the one section the reviewer's
 * view has to render differently rather than merely read-only.
 *
 * A lookup table rather than a switch, and exported rather than held inside
 * AbschnittInhalt, because feature 11e made the reviewer's page the second place
 * that turns a section number into a section. Two switches would have been two
 * places to remember when an eighth section arrives. The Record is keyed by the
 * section numbers themselves, so adding one to ABSCHNITTE without adding it here
 * is a build error rather than a blank page.
 */
export const ABSCHNITTSKOERPER = {
  1: Abschnitt1,
  2: Abschnitt2,
  3: Abschnitt3,
  4: Abschnitt4,
  5: Abschnitt5,
  6: Abschnitt6,
} as const satisfies Record<Exclude<Abschnitt['nr'], 7>, ComponentType>
