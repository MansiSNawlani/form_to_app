/* Where a refused answer lives, so the panel can send somebody to it.
 *
 * The backend refuses a submit with a list of paths and message keys. A path is
 * exact and machine-readable and means nothing to a surveyor, so this turns it
 * into the two things a person needs: which section of the form to open, and
 * what the field is called there.
 *
 * **Three sections are read rather than restated.** Parts 3, 4 and 5 already
 * declare their fields as path and label pairs, because their blocks are
 * rendered by mapping over a list rather than written out one control at a time.
 * Importing those is what keeps the panel's label the same as the label above
 * the field it points at.
 *
 * Parts 1, 2 and 6 have no such list: their controls carry the label key inline
 * as a prop, so their entries are written out below. That is a second place
 * holding the same key, and it is the known cost of this file. A test pins every
 * key to the locale file, so a key that never existed is a failing test rather
 * than a panel printing its own key at a surveyor, but a key that is changed in
 * the component and not here would go unnoticed. Declaring those three sections
 * the way parts 3 to 5 are declared would close it, and is a refactor of its own
 * rather than part of this feature.
 *
 * Nothing here translates. A function reaching for i18next could not be tested
 * without initialising it, so it hands back keys and the component says them,
 * the same arrangement liste/anzeige.ts and regeln/regel.ts already use.
 */

import type { ParseKeys } from 'i18next'
import { PROZENTGRUPPEN } from '../abschnitte/teil3/gruppen'
import {
  BESATZZEILEN,
  BEWIRTSCHAFTUNG,
  EINFLUESSE,
  EINFLUSS_WIDERSPRUCH,
  STRUKTUREN,
} from '../abschnitte/teil4/bloecke'
import {
  ANODEN_PAAR,
  BEFISCHTE_BEREICHE,
  BREITE_PAAR,
  LAENGE_PAAR,
  NETZE,
} from '../abschnitte/teil5/bloecke'

/** Which section of the form an answer sits in. */
export type Abschnittsnummer = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Verortung {
  /** Where to send the person, or null when we do not recognise the path. */
  abschnitt: Abschnittsnummer | null
  /** What the field is called, as a key. null when we have no name for it. */
  labelKey: ParseKeys | null
}

const UNBEKANNT: Verortung = { abschnitt: null, labelKey: null }

/* Part 1: the occasion, the recorder and the stretch.
 *
 * messdaten.uhrzeit is here and not in part 2 with the rest of messdaten,
 * because the form puts the time of the survey beside its date, which is where
 * somebody looks for it.
 */
const TEIL_1: Record<string, ParseKeys> = {
  anlass: 'protokoll.abschnitt1.anlass.feld.anlass',
  'probestrecke.monitoringnummer': 'protokoll.abschnitt1.anlass.feld.monitoringnummer',
  'z.rp': 'protokoll.abschnitt1.anlass.feld.rp',
  datum: 'protokoll.abschnitt1.anlass.feld.datum',
  'messdaten.uhrzeit': 'protokoll.abschnitt1.anlass.feld.uhrzeit',
  'z.quelle': 'protokoll.abschnitt1.anlass.feld.quelle',
  'z.ps_nummer': 'protokoll.abschnitt1.anlass.feld.psNummer',
  'bearbeiter.name': 'protokoll.abschnitt1.bearbeiter.feld.name',
  'bearbeiter.firma': 'protokoll.abschnitt1.bearbeiter.feld.firma',
  'bearbeiter.strasse': 'protokoll.abschnitt1.bearbeiter.feld.strasse',
  'bearbeiter.plz': 'protokoll.abschnitt1.bearbeiter.feld.plz',
  'bearbeiter.ort': 'protokoll.abschnitt1.bearbeiter.feld.ort',
  'bearbeiter.telefon': 'protokoll.abschnitt1.bearbeiter.feld.telefon',
  'bearbeiter.email': 'protokoll.abschnitt1.bearbeiter.feld.email',
  'probestrecke.gewaesser.gewaessername': 'protokoll.abschnitt1.probestrecke.feld.gewaessername',
  'probestrecke.gewaessertyp': 'protokoll.abschnitt1.probestrecke.feld.gewaessertyp',
  'probestrecke.ortsangabe': 'protokoll.abschnitt1.probestrecke.feld.ortsangabe',
  'probestrecke.laenge': 'protokoll.abschnitt1.probestrecke.feld.laenge',
  'probestrecke.untere': 'protokoll.abschnitt1.probestrecke.feld.untere',
  'probestrecke.obere': 'protokoll.abschnitt1.probestrecke.feld.obere',
  'probestrecke.utm_rw_unten': 'protokoll.abschnitt1.probestrecke.feld.utmRwUnten',
  'probestrecke.utm_hw_unten': 'protokoll.abschnitt1.probestrecke.feld.utmHwUnten',
  'probestrecke.utm_rw_oben': 'protokoll.abschnitt1.probestrecke.feld.utmRwOben',
  'probestrecke.utm_hw_oben': 'protokoll.abschnitt1.probestrecke.feld.utmHwOben',
}

/* The receiving-water chain: five boxes, each with its own numbered label, so
   the panel can say which link in the chain is the problem. */
const VORFLUTER: readonly ParseKeys[] = [
  'protokoll.abschnitt1.probestrecke.feld.vorfluter1',
  'protokoll.abschnitt1.probestrecke.feld.vorfluter2',
  'protokoll.abschnitt1.probestrecke.feld.vorfluter3',
  'protokoll.abschnitt1.probestrecke.feld.vorfluter4',
  'protokoll.abschnitt1.probestrecke.feld.vorfluter5',
]
VORFLUTER.forEach((labelKey, index) => {
  TEIL_1[`probestrecke.gewaesser.vorfluter${index + 1}`] = labelKey
})

/** Part 2: the measurements and the hydrology. */
const TEIL_2: Record<string, ParseKeys> = {
  'messdaten.temperatur': 'protokoll.abschnitt2.messdaten.feld.temperatur',
  'messdaten.leitfaehigkeit': 'protokoll.abschnitt2.messdaten.feld.leitfaehigkeit',
  'messdaten.sichttiefe': 'protokoll.abschnitt2.messdaten.feld.sichttiefe',
  'messdaten.regenfaelle': 'protokoll.abschnitt2.messdaten.feld.regenfaelle',
  'messdaten.truebung': 'protokoll.abschnitt2.messdaten.feld.truebung',
  'messdaten.schaumbildung': 'protokoll.abschnitt2.messdaten.feld.schaumbildung',
  'hydrologie.breite': 'protokoll.abschnitt2.hydrologie.feld.breite',
  'hydrologie.breite_schaetzwert': 'protokoll.abschnitt2.hydrologie.feld.breiteSchaetzwert',
  'hydrologie.tiefe': 'protokoll.abschnitt2.hydrologie.feld.tiefe',
  'hydrologie.tiefe_schaetzwert': 'protokoll.abschnitt2.hydrologie.feld.tiefeSchaetzwert',
  'hydrologie.tiefenvarianz': 'protokoll.abschnitt2.hydrologie.feld.tiefenvarianz',
  'hydrologie.linienfuehrung': 'protokoll.abschnitt2.hydrologie.feld.linienfuehrung',
  'hydrologie.stroemung': 'protokoll.abschnitt2.hydrologie.feld.stroemung',
  'hydrologie.fliessgeschwindigkeit': 'protokoll.abschnitt2.hydrologie.feld.fliessgeschwindigkeit',
  'hydrologie.wasserfuehrung': 'protokoll.abschnitt2.hydrologie.feld.wasserfuehrung',
  'hydrologie.stillwasserbereich': 'protokoll.abschnitt2.hydrologie.feld.stillwasserbereich',
  'hydrologie.gesamtprofil': 'protokoll.abschnitt2.hydrologie.feld.gesamtprofil',
  'hydrologie.furkationen': 'protokoll.abschnitt2.hydrologie.feld.furkationen',
  'hydrologie.mit_gumpen': 'protokoll.abschnitt2.hydrologie.feld.mitGumpen',
  'hydrologie.mit_flachstellen': 'protokoll.abschnitt2.hydrologie.feld.mitFlachstellen',
  'hydrologie.rueckstroemung': 'protokoll.abschnitt2.hydrologie.feld.rueckstroemung',
}

/* The standalone controls in parts 3, 4 and 5.
 *
 * Those sections declare their repeating blocks as lists, which ausDeklarationen
 * below reads, but each also carries a handful of one-off controls written out
 * in the component with the label key inline. These are those.
 */
const EINZELFELDER: Record<string, { abschnitt: Abschnittsnummer; labelKey: ParseKeys }> = {
  'gewaessersohle.kolmatierte_sohle': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.kolmatierteSohle',
  },
  'gewaessersohle.eisenocker': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.eisenocker',
  },
  'gewaessersohle.treibsand': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.treibsand',
  },
  'gewaessersohle.faulschlamm': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.gewaessersohle.feld.faulschlamm',
  },
  'ufer.randstreifen': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.ufer.feld.randstreifen',
  },
  'ufer.streckenanteil_geschuetteter_damm': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.ufer.feld.geschuetteterDamm',
  },
  'ufer.neigung': { abschnitt: 3, labelKey: 'protokoll.abschnitt3.ufer.feld.dammNeigung' },
  'ufer.buhnenbereich': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.ufer.feld.buhnenbereich',
  },
  'ufer.wurzeln': { abschnitt: 3, labelKey: 'protokoll.abschnitt3.ufer.feld.wurzeln' },
  'ufer.sonstiger_bewuchs_text': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.ufer.feld.sonstigerBewuchsText',
  },
  'ufer.sonstiger_uferverbau_text': {
    abschnitt: 3,
    labelKey: 'protokoll.abschnitt3.ufer.feld.sonstigerUferverbauText',
  },
  'bemerkungen.sonstige_bemerkungen': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.bemerkungen.feld.sonstigeBemerkungen',
  },
  'bewirschaftung.fischereiausübungsberechtigter': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.feld.berechtigter',
  },
  'einfluesse.sonstige_nutzung_text': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.einfluesse.feld.sonstigeNutzungText',
  },
  'strukturen.sonstige_strukturen_text': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.strukturen.feld.sonstigeStrukturenText',
  },
  'ausruestung.egeraet': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.egeraet',
  },
  'ausruestung.spannung': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.spannung',
  },
  'ausruestung.leistung': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.leistung',
  },
  'ausruestung.bauweise': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.ausruestung.feld.bauweise',
  },
  'anodenfuehrer.vorname': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anodenfuehrer.feld.vorname',
  },
  'anodenfuehrer.nachname': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anodenfuehrer.feld.nachname',
  },
  'ausruestung.ringanoden': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anoden.feld.ringanoden',
  },
  'ausruestung.ringanoden_durchmesser': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anoden.feld.ringanodenDurchmesser',
  },
  'ausruestung.streifenanoden': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anoden.feld.streifenanoden',
  },
  'ausruestung.kathode': {
    abschnitt: 5,
    labelKey: 'protokoll.abschnitt5.anoden.feld.kathode',
  },
}

/** Part 6: the catch table's free text. The table itself is handled by pattern. */
const TEIL_6: Record<string, ParseKeys> = {
  'bemerkungen.bemerkung_fische': 'protokoll.abschnitt6.bemerkung.feld',
}

/* Parts 3, 4 and 5, built from the declarations those sections already render
   from, so the panel's label is the same object as the label above the field. */
function ausDeklarationen(): Map<string, { abschnitt: Abschnittsnummer; labelKey: ParseKeys }> {
  const eintraege = new Map<string, { abschnitt: Abschnittsnummer; labelKey: ParseKeys }>()

  for (const gruppe of PROZENTGRUPPEN) {
    // The group's own pseudo-path, which is what a total that is not 100 points
    // at: the fault is the set of shares, not any one of them.
    eintraege.set(gruppe.id, { abschnitt: 3, labelKey: gruppe.legendKey })
    for (const feld of gruppe.felder) {
      eintraege.set(feld.pfad, { abschnitt: 3, labelKey: feld.labelKey })
    }
  }

  for (const feld of [...STRUKTUREN, ...EINFLUESSE, ...BEWIRTSCHAFTUNG]) {
    eintraege.set(feld.pfad, { abschnitt: 4, labelKey: feld.labelKey })
  }
  /* The stocking rows carry three paths each and one legend naming the row, so
     all three point at the row rather than at a label of their own: "Jahr" on
     its own would not say which of the four rows it meant. */
  for (const zeile of BESATZZEILEN) {
    for (const pfad of [zeile.fischart, zeile.groessenklassen, zeile.jahr]) {
      eintraege.set(pfad, {
        abschnitt: 4,
        labelKey: 'protokoll.abschnitt4.bewirtschaftung.besatz.legend',
      })
    }
  }

  for (const feld of NETZE) {
    eintraege.set(feld.pfad, { abschnitt: 5, labelKey: feld.labelKey })
  }
  for (const bereich of BEFISCHTE_BEREICHE) {
    // The length and the width are named by their row, for the same reason the
    // stocking rows are: two rows carry the same two measurements.
    for (const pfad of [bereich.laenge, bereich.breite]) {
      eintraege.set(pfad, { abschnitt: 5, labelKey: bereich.legendKey })
    }
    for (const feld of [...bereich.richtung, ...bereich.methode]) {
      eintraege.set(feld.pfad, { abschnitt: 5, labelKey: feld.labelKey })
    }
  }

  return eintraege
}

/* The pseudo-paths, where what is wrong is a combination rather than a field.
 *
 * Each points at the block it concerns rather than at a control, because there
 * is no single control to blame: two ticks that contradict each other, or a pair
 * of numbers that between them say nothing.
 */
const KOMBINATIONEN: Record<string, { abschnitt: Abschnittsnummer; labelKey: ParseKeys }> = {
  [EINFLUSS_WIDERSPRUCH]: {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.einfluesse.legend',
  },
  [ANODEN_PAAR]: { abschnitt: 5, labelKey: 'protokoll.abschnitt5.ausruestung.legend' },
  [LAENGE_PAAR]: { abschnitt: 5, labelKey: 'protokoll.abschnitt5.bereiche.legend' },
  [BREITE_PAAR]: { abschnitt: 5, labelKey: 'protokoll.abschnitt5.bereiche.legend' },
  'block.einfluesse': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.einfluesse.legend',
  },
  'block.bewirtschaftung': {
    abschnitt: 4,
    labelKey: 'protokoll.abschnitt4.bewirtschaftung.legend',
  },
  'tabelle.arten': { abschnitt: 6, labelKey: 'protokoll.abschnitt6.tabelle.legend' },
}

const DEKLARIERT = ausDeklarationen()

/* The catch table is 26 rows of 12 answers, so its 312 paths are recognised by
   shape rather than listed. Matching arten.art7.klasse_3, arten.art7.name and
   arten.art7.0plus. */
const ARTENZELLE = /^arten\.art(\d{1,2})\.(name|0plus|klasse_\d{1,2})$/

export function verorte(pfad: string): Verortung {
  const deklariert = DEKLARIERT.get(pfad) ?? KOMBINATIONEN[pfad] ?? EINZELFELDER[pfad]
  if (deklariert !== undefined) {
    return { abschnitt: deklariert.abschnitt, labelKey: deklariert.labelKey }
  }

  const teil1 = TEIL_1[pfad]
  if (teil1 !== undefined) return { abschnitt: 1, labelKey: teil1 }

  const teil2 = TEIL_2[pfad]
  if (teil2 !== undefined) return { abschnitt: 2, labelKey: teil2 }

  const teil6 = TEIL_6[pfad]
  if (teil6 !== undefined) return { abschnitt: 6, labelKey: teil6 }

  /* A catch cell gets the section but no label of its own. The panel names the
     row by the species in it, which is the only name that means anything here:
     "Zeile 7" would send somebody counting rows. */
  if (ARTENZELLE.test(pfad)) return { abschnitt: 6, labelKey: null }

  /* A path we do not recognise. Still listed by the panel, with its message and
     no link, rather than dropped: a rule added to the backend and not here would
     otherwise go silently missing, and a violation nobody can see is worse than
     one nobody can click. */
  return UNBEKANNT
}

/** The catch row a path belongs to, for naming it by its species. */
export function artnummerAus(pfad: string): number | null {
  const treffer = ARTENZELLE.exec(pfad)
  return treffer === null ? null : Number(treffer[1])
}
