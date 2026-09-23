/* Every field's German label, read out of the form components themselves.
 *
 * Feature 23e builds a PDF of a filed protocol on the backend, and a PDF needs
 * to print "mittlere Breite" rather than hydrologie.breite. Those words exist
 * only here, in the frontend: de.json holds the wording, and which wording
 * belongs to which answer path is decided in the 26 block components.
 *
 * So the backend cannot label anything without a copy, and a hand-typed copy is
 * exactly what nurlesen/ProtokollNurLesen.tsx refuses to make for the read-only
 * view: "the copy would drift from the form the first time a label changed".
 * This script generates it instead, into database/seed/, beside felder.json and
 * optionslisten.json, because a label belongs to a form version and not to a
 * screen.
 *
 * Run it with `npm run beschriftungen` after changing a label or adding a field.
 * beschriftungen.test.ts fails when the committed file is out of date, and the
 * backend's own test fails when a field has no label at all, so neither a stale
 * file nor a missed field can pass unnoticed.
 *
 * Read with the TypeScript compiler rather than by importing the components.
 * Importing them would mean rendering React in a test environment this project
 * deliberately does not have (vite.config.ts: "Node, not a simulated browser"),
 * and adding one would invite the component unit tests coding-standards.md
 * rules out. Parsing is not a regex either: it is the same parser the build
 * uses, so a construct it cannot see is a construct that does not compile.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HIER = fileURLToPath(new URL('.', import.meta.url))
const BLOECKE = join(HIER, '..', 'src', 'protokoll')
const DE = join(HIER, '..', 'src', 'i18n', 'locales', 'de.json')
const ZIEL = join(
  HIER,
  '..',
  '..',
  'database',
  'seed',
  'form_version_20260609',
  'beschriftungen.json',
)

/** The form version these labels belong to. ADR 0004: versions are never migrated. */
const VERSION = '20260609'

export interface Beschriftungen {
  version: string
  quelle: string
  anzahl: number
  beschriftungen: Record<string, string>
}

function quelldateien(ordner: string): string[] {
  const raus: string[] = []
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag)
    if (statSync(pfad).isDirectory()) raus.push(...quelldateien(pfad))
    else if (/\.tsx?$/.test(eintrag) && !/\.test\.tsx?$/.test(eintrag)) raus.push(pfad)
  }
  return raus
}

/** A string literal, whether written bare or wrapped in JSX braces. */
function alsText(knoten: ts.Node | undefined): string | undefined {
  if (!knoten) return undefined
  if (ts.isStringLiteral(knoten)) return knoten.text
  if (ts.isJsxExpression(knoten) && knoten.expression && ts.isStringLiteral(knoten.expression)) {
    return knoten.expression.text
  }
  return undefined
}

/** The identifier in `name={fischart}`, which a declared table supplies. */
function alsName(knoten: ts.Node | undefined): string | undefined {
  if (knoten && ts.isJsxExpression(knoten) && knoten.expression && ts.isIdentifier(knoten.expression)) {
    return knoten.expression.text
  }
  return undefined
}

/* An answer path, as far as this script can tell from a string alone: dotted,
   lower case, no spaces. Only used to decide which properties of a declared
   table are worth remembering, so a false positive costs nothing: it becomes an
   entry nobody ever asks for, and the backend test still checks the real list. */
const PFADFORM = /^[a-zäöüß][\wäöüß]*(\.[\wäöüß]+)+$/i

interface Fund {
  pfade: string[]
  labelKey: string
}

/* Three shapes, because the form declares its fields in three ways and all
   three are deliberate.

   1. Written out in the component:  <FeldText name="hydrologie.breite" labelKey="..." />
      Parts 1, 2, 6 and 7, where the fields differ from one another.
   2. Declared as data:              { pfad: 'ufer.graeser', labelKey: '...' }
      Parts 3, 4 and 5, where a run of near-identical fields is mapped over.
      teil3/gruppen.ts explains why.
   3. A row mapped over a table:     <FeldSuche name={fischart} labelKey="..." />
      The four Besatz rows and the two befischte Bereiche. The path sits in the
      table under the same property name the component destructured, so the
      identifier is the link: every `fischart` property of every declared table
      gets the labelKey written beside `name={fischart}`. */
function lies(datei: string, nachSchluessel: Map<string, string[]>, funde: Fund[]) {
  const quelle = ts.createSourceFile(
    datei,
    readFileSync(datei, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  const besuche = (knoten: ts.Node) => {
    if (ts.isJsxOpeningLikeElement(knoten)) {
      let pfad: string | undefined
      let ueber: string | undefined
      let labelKey: string | undefined
      for (const attribut of knoten.attributes.properties) {
        if (!ts.isJsxAttribute(attribut)) continue
        const wie = attribut.name.getText()
        if (wie === 'name') {
          pfad = alsText(attribut.initializer)
          ueber = alsName(attribut.initializer)
        }
        if (wie === 'labelKey') labelKey = alsText(attribut.initializer)
      }
      if (labelKey && pfad) funde.push({ pfade: [pfad], labelKey })
      if (labelKey && ueber) funde.push({ pfade: nachSchluessel.get(ueber) ?? [], labelKey })
    }

    if (ts.isObjectLiteralExpression(knoten)) {
      let pfad: string | undefined
      let labelKey: string | undefined
      for (const eigenschaft of knoten.properties) {
        if (!ts.isPropertyAssignment(eigenschaft)) continue
        const wie = eigenschaft.name.getText()
        const wert = alsText(eigenschaft.initializer)
        if (wie === 'pfad') pfad = wert
        if (wie === 'labelKey') labelKey = wert
        if (wert && PFADFORM.test(wert)) {
          nachSchluessel.set(wie, [...(nachSchluessel.get(wie) ?? []), wert])
        }
      }
      if (pfad && labelKey) funde.push({ pfade: [pfad], labelKey })
    }

    ts.forEachChild(knoten, besuche)
  }

  besuche(quelle)
}

/** A dotted key out of de.json, or undefined when it names no text. */
function text(de: unknown, schluessel: string): string | undefined {
  let hier: unknown = de
  for (const teil of schluessel.split('.')) {
    if (hier === null || typeof hier !== 'object') return undefined
    hier = (hier as Record<string, unknown>)[teil]
  }
  return typeof hier === 'string' ? hier : undefined
}

export function sammle(): Beschriftungen {
  const dateien = quelldateien(BLOECKE).sort()

  /* Two passes, because a component is read before the table it maps over as
     often as after it, and rule 3 above needs the table first. */
  const nachSchluessel = new Map<string, string[]>()
  const funde: Fund[] = []
  for (const datei of dateien) lies(datei, nachSchluessel, [])
  for (const datei of dateien) lies(datei, nachSchluessel, funde)

  const de: unknown = JSON.parse(readFileSync(DE, 'utf8'))
  const beschriftungen: Record<string, string> = {}
  const ohneText: string[] = []

  for (const { pfade, labelKey } of funde) {
    const wort = text(de, labelKey)
    if (wort === undefined) {
      ohneText.push(labelKey)
      continue
    }
    for (const pfad of pfade) beschriftungen[pfad] = wort
  }

  /* A label key naming no German text is a bug in the component, not something
     to paper over: the field would print with no name at all. */
  if (ohneText.length > 0) {
    throw new Error(`Diese labelKey nennen keinen Text in de.json: ${ohneText.join(', ')}`)
  }

  const sortiert = Object.fromEntries(
    Object.entries(beschriftungen).sort(([a], [b]) => a.localeCompare(b)),
  )

  return {
    version: VERSION,
    quelle: 'frontend/src/protokoll, gelesen von frontend/scripts/beschriftungen.ts',
    anzahl: Object.keys(sortiert).length,
    beschriftungen: sortiert,
  }
}

/** What the committed file holds, so the test can compare without rewriting it. */
export function gespeichert(): Beschriftungen {
  return JSON.parse(readFileSync(ZIEL, 'utf8')) as Beschriftungen
}

export function schreibe(): number {
  const inhalt = sammle()
  writeFileSync(ZIEL, `${JSON.stringify(inhalt, null, 2)}\n`, 'utf8')
  return inhalt.anzahl
}

// Written only when run as a script, never on import: the test imports sammle.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  console.log(`${schreibe()} Beschriftungen geschrieben nach ${ZIEL}`)
}
