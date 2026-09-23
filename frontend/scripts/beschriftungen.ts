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
  /** The outline the document prints: sections, their blocks, and what is in them. */
  abschnitte: Abschnitt[]
  /** The six runs of shares that each have to total 100, so the document can print the total. */
  gruppen: Gruppe[]
  /** What each status is called, so a printed protocol says Entwurf rather than DRAFT. */
  status: Record<string, string>
  /** Answers the title block prints, so no section prints them a second time. */
  kopffelder: string[]
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

/* One of the six runs that must add up to 100, as teil3/gruppen.ts declares it.
   The document prints a total under each, the way the screen shows one, and a
   protocol whose shares do not reach 100 should say so on paper too. */
interface Gruppenfund {
  id: string
  legendKey: string
  pfade: string[]
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
function lies(
  datei: string,
  nachSchluessel: Map<string, string[]>,
  funde: Fund[],
  gruppen: Gruppenfund[],
) {
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

      /* A Prozentgruppe: an id, a legend and a list of its own shares. Only
         teil3/gruppen.ts has this shape, and its ids all begin summe. */
      const id = alsText(eigenschaftVon(knoten, 'id'))
      const legendKey = alsText(eigenschaftVon(knoten, 'legendKey'))
      const felder = eigenschaftVon(knoten, 'felder')
      if (id?.startsWith('summe.') && legendKey && felder && ts.isArrayLiteralExpression(felder)) {
        const pfade: string[] = []
        for (const eintrag of felder.elements) {
          if (!ts.isObjectLiteralExpression(eintrag)) continue
          const wert = alsText(eigenschaftVon(eintrag, 'pfad'))
          if (wert) pfade.push(wert)
        }
        if (pfade.length > 0) gruppen.push({ id, legendKey, pfade })
      }
    }

    ts.forEachChild(knoten, besuche)
  }

  besuche(quelle)
}

/** One property of an object literal, by name. */
function eigenschaftVon(knoten: ts.ObjectLiteralExpression, wie: string): ts.Node | undefined {
  for (const eigenschaft of knoten.properties) {
    if (ts.isPropertyAssignment(eigenschaft) && eigenschaft.name.getText() === wie) {
      return eigenschaft.initializer
    }
  }
  return undefined
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
  const gruppenfunde: Gruppenfund[] = []
  for (const datei of dateien) lies(datei, nachSchluessel, [], [])
  for (const datei of dateien) lies(datei, nachSchluessel, funde, gruppenfunde)

  const de: unknown = JSON.parse(readFileSync(DE, 'utf8'))
  const beschriftungen: Record<string, string> = {}
  const ohneText: string[] = []
  /* Insertion order is the order the fields are declared in, which within one
     block is the order they appear on screen. The document prints them in that
     order, so it is kept rather than sorted away. */
  const reihenfolge: string[] = []

  for (const { pfade, labelKey } of funde) {
    const wort = text(de, labelKey)
    if (wort === undefined) {
      ohneText.push(labelKey)
      continue
    }
    for (const pfad of pfade) {
      if (!(pfad in beschriftungen)) reihenfolge.push(pfad)
      beschriftungen[pfad] = wort
    }
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
    abschnitte: gliedere(de, reihenfolge),
    gruppen: gruppenfunde.map((gruppe) => ({
      titel: pflichtText(de, gruppe.legendKey),
      pfade: gruppe.pfade,
    })),
    /* The same wording the list and the badge use. A printed protocol saying
       DRAFT would be the one place in the application that does. */
    status: statuswoerter(de),
    kopffelder: KOPFFELDER,
    beschriftungen: sortiert,
  }
}

/* Which fields the document prints under which heading.
 *
 * The outline the backend prints from, and it lives here rather than there for
 * the same reason the labels do: it mirrors the screens, and the screens are
 * here. The backend renders what this says and decides nothing about order.
 *
 * A block is a path prefix, so nothing has to be listed field by field, and the
 * fields inside it keep the order they are declared in. Four fields sit
 * somewhere other than their prefix suggests and are named one by one:
 * messdaten.uhrzeit is asked for in section 1 although the PDF files it with the
 * readings, and the two remarks boxes belong to the sections they are printed
 * under rather than to each other.
 *
 * The titles are keys into de.json, the same keys the components use, so the
 * document says what the screen says.
 */
interface Blockplan {
  titelKey: string
  praefix?: string
  felder?: string[]
  ohne?: string[]
  fangtabelle?: true
}

interface Abschnittsplan {
  titelKey: string
  bloecke: Blockplan[]
}

/* Printed in the title block at the top of the document rather than in a
   section, so the first thing anybody reads is which water, which day and what
   state the protocol is in. Listed here so the completeness check below still
   accounts for them: a field that is neither in a block nor here is a field the
   document would silently drop. */
const KOPFFELDER = ['datum', 'messdaten.uhrzeit']

const GLIEDERUNG: Abschnittsplan[] = [
  {
    titelKey: 'protokoll.abschnitte.anlass',
    bloecke: [
      /* Not datum and not messdaten.uhrzeit. Both are printed in the title
         block at the top of the document, and a fact stated twice on one page
         reads as two facts that happen to agree. */
      {
        titelKey: 'protokoll.abschnitt1.anlass.legend',
        felder: ['anlass', 'z.rp', 'z.quelle', 'z.ps_nummer'],
      },
      { titelKey: 'protokoll.abschnitt1.bearbeiter.legend', praefix: 'bearbeiter.' },
      { titelKey: 'protokoll.abschnitt1.probestrecke.legend', praefix: 'probestrecke.' },
    ],
  },
  {
    titelKey: 'protokoll.abschnitte.messdaten',
    bloecke: [
      {
        titelKey: 'protokoll.abschnitt2.messdaten.legend',
        praefix: 'messdaten.',
        ohne: ['messdaten.uhrzeit'],
      },
      { titelKey: 'protokoll.abschnitt2.hydrologie.legend', praefix: 'hydrologie.' },
    ],
  },
  {
    titelKey: 'protokoll.abschnitte.umland',
    bloecke: [
      { titelKey: 'protokoll.abschnitt3.umland.legend', praefix: 'umland.' },
      { titelKey: 'protokoll.abschnitt3.ufer.legend', praefix: 'ufer.' },
      { titelKey: 'protokoll.abschnitt3.gewaessersohle.legend', praefix: 'gewaessersohle.' },
    ],
  },
  {
    titelKey: 'protokoll.abschnitte.struktur',
    bloecke: [
      { titelKey: 'protokoll.abschnitt4.strukturen.legend', praefix: 'strukturen.' },
      { titelKey: 'protokoll.abschnitt4.einfluesse.legend', praefix: 'einfluesse.' },
      { titelKey: 'protokoll.abschnitt4.bewirtschaftung.legend', praefix: 'bewirschaftung.' },
      {
        titelKey: 'protokoll.abschnitt4.bemerkungen.legend',
        felder: ['bemerkungen.sonstige_bemerkungen'],
      },
    ],
  },
  {
    titelKey: 'protokoll.abschnitte.ausruestung',
    bloecke: [
      { titelKey: 'protokoll.abschnitt5.ausruestung.legend', praefix: 'ausruestung.' },
      { titelKey: 'protokoll.abschnitt5.anodenfuehrer.legend', praefix: 'anodenfuehrer.' },
      { titelKey: 'protokoll.abschnitt5.bereiche.legend', praefix: 'befischte_bereiche.' },
    ],
  },
  {
    titelKey: 'protokoll.abschnitte.faenge',
    bloecke: [
      { titelKey: 'protokoll.abschnitt6.tabelle.legend', fangtabelle: true },
      {
        titelKey: 'protokoll.abschnitt6.bemerkung.legend',
        felder: ['bemerkungen.bemerkung_fische'],
      },
    ],
  },
]

export interface Block {
  titel: string
  /** The catch table prints as a table of its own, not as label and value. */
  fangtabelle: boolean
  pfade: string[]
}

export interface Abschnitt {
  titel: string
  bloecke: Block[]
}

export interface Gruppe {
  titel: string
  pfade: string[]
}

function gliedere(de: unknown, reihenfolge: string[]): Abschnitt[] {
  const vergeben = new Set<string>(KOPFFELDER)

  const abschnitte = GLIEDERUNG.map((plan) => ({
    titel: pflichtText(de, plan.titelKey),
    bloecke: plan.bloecke.map((block) => {
      const ohne = new Set(block.ohne ?? [])
      const pfade = block.fangtabelle
        ? []
        : (block.felder ?? reihenfolge.filter((p) => p.startsWith(block.praefix ?? '\0'))).filter(
            (p) => !ohne.has(p) && !vergeben.has(p),
          )
      for (const pfad of pfade) vergeben.add(pfad)
      return { titel: pflichtText(de, block.titelKey), fangtabelle: block.fangtabelle ?? false, pfade }
    }),
  }))

  /* Every labelled field has to be printed somewhere. A field that belongs to no
     block would simply be missing from the document, and nobody reading a PDF
     can tell that an answer they gave was left out of it. */
  const heimatlos = reihenfolge.filter((pfad) => !vergeben.has(pfad))
  if (heimatlos.length > 0) {
    throw new Error(`Diese Felder gehoeren zu keinem Block: ${heimatlos.join(', ')}`)
  }

  return abschnitte
}

function statuswoerter(de: unknown): Record<string, string> {
  const woerter: Record<string, string> = {}
  for (const status of [
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'NEEDS_CHANGES',
    'REJECTED',
    'ACCEPTED',
    'LOCKED',
  ]) {
    woerter[status] = pflichtText(de, `protokolle.list.status.${status}`)
  }
  return woerter
}

function pflichtText(de: unknown, schluessel: string): string {
  const wort = text(de, schluessel)
  if (wort === undefined) throw new Error(`${schluessel} nennt keinen Text in de.json`)
  return wort
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
