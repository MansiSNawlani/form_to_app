import { istLeer, type Regel, type Regelverstoss } from './regel'
import type { Antworten, AntwortPfad } from '../entwurf/typen'

/* The receiving-water chain, read downstream from the Probestrecke: this
   Gewaesser flows into that one, which flows into the next. It has to arrive at
   the Rhein or the Donau, because that is what fixes where the stretch sits in
   the state's drainage network. CONTEXT.md defines the term.

   Defect 8 in docs/ffs-defect-list.md is why this rule exists at all: the legacy
   form checks the chain while the user types, then checks only the first box at
   submit, so a chain filled in and then cleared passes today. */

type Gewaesser = NonNullable<NonNullable<Antworten['probestrecke']>['gewaesser']>

/* The five boxes, named once. Both the paths the form addresses them by and the
   values read out of the document come from this list, so the chain cannot grow
   a sixth link in one place and not the other. */
const VORFLUTER_FELDER = [
  'vorfluter1',
  'vorfluter2',
  'vorfluter3',
  'vorfluter4',
  'vorfluter5',
] as const satisfies readonly (keyof Gewaesser)[]

export const VORFLUTER_PFADE = VORFLUTER_FELDER.map(
  (feld) => `probestrecke.gewaesser.${feld}` as const,
) satisfies readonly AntwortPfad[]

const ENDPUNKTE = ['rhein', 'donau']

/* Loose on the way in, faithful on the way out. The match ignores case and
   spacing and accepts a name that merely contains the word, so "Alte Donau" and
   "Oberrhein" both end a chain. Nothing here rewrites the answer: defect 2 in
   docs/ffs-defect-list.md is the legacy form lowercasing every water body name,
   which is one of the three defects that put wrong data into FiaKa. */
function istEndpunkt(name: string | undefined): boolean {
  const normalisiert = (name ?? '').trim().toLowerCase()
  return ENDPUNKTE.some((endpunkt) => normalisiert.includes(endpunkt))
}

function verstoss(index: number, schluessel: Regelverstoss['schluessel']) {
  return { pfad: VORFLUTER_PFADE[index], schluessel }
}

export const pruefeVorfluterkette: Regel = (antworten) => {
  const gewaesser = antworten.probestrecke?.gewaesser
  const kette = VORFLUTER_FELDER.map((feld) => gewaesser?.[feld])

  const gefuellt = kette.map((name) => !istLeer(name))
  // An untouched chain is not a wrong chain. A draft is half-finished by
  // definition, and whether the chain is required at all is feature 11's gate.
  if (!gefuellt.some(Boolean)) return []

  const endeIndex = kette.findIndex(
    (name, index) => gefuellt[index] && istEndpunkt(name),
  )
  const letzterIndex = gefuellt.lastIndexOf(true)
  // Where the chain stops being a chain: at its terminator if it has one, at
  // its last entry if it does not.
  const ende = endeIndex === -1 ? letzterIndex : endeIndex

  const verstoesse: Regelverstoss[] = []

  for (let index = 0; index < ende; index += 1) {
    if (!gefuellt[index]) {
      verstoesse.push(verstoss(index, 'protokoll.regeln.vorfluterLuecke'))
    }
  }

  if (endeIndex === -1) {
    verstoesse.push(verstoss(ende, 'protokoll.regeln.vorfluterKeinEndpunkt'))
    return verstoesse
  }

  // Only the first entry past the end. Everything after it is the same mistake
  // said again, and four red boxes for one wrong idea is noise.
  const zuWeit = gefuellt.indexOf(true, ende + 1)
  if (zuWeit !== -1) {
    verstoesse.push(verstoss(zuWeit, 'protokoll.regeln.vorfluterNachEndpunkt'))
  }

  return verstoesse
}
