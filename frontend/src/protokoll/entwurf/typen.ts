/* The shape of a protocol while it is being filled in.
 *
 * Load-bearing. Features 4b to 9 add their fields to Antworten, and feature 3
 * sends this same document to the server, so the envelope deliberately mirrors
 * the Submission columns in project-overview.md: matching shapes make feature 3
 * a plumbing change rather than a reshape of every form component.
 */

import type { FieldPathByValue } from 'react-hook-form'

/** ADR 0004: a submission is never migrated to a later form version. */
export const FORM_VERSION = '20260609'

/* Answers nested so that each path spells out the legacy PDF field path exactly:
 * probestrecke.gewaesser.vorfluter1, messdaten.uhrzeit, and so on. React Hook
 * Form addresses a field by its dotted name, so a field registered under its
 * legacy path writes to the right place with no mapping layer, and the eventual
 * FiaKa transfer stays a direct match.
 *
 * Every key is optional because a draft is incomplete by definition. Required
 * means "required to submit", which is feature 11's gate.
 *
 * Every value is a string, including the coordinates and the length. A number
 * input holds "54" mid-typing and "" when cleared, and neither is a number; the
 * legacy PDF stores every field as text anyway, which keeps the eventual FiaKa
 * transfer a direct match. Turning a string into an integer is a validation
 * concern and belongs at the boundary, in feature 4c's Zod schema and later in
 * Pydantic, not in a field component.
 *
 * undefined means never touched, "" means touched and cleared. Nothing yet
 * distinguishes the two.
 *
 * Part 1 exists so far. Features 5 to 9 add their own groups, each at its own
 * legacy path.
 */
export interface Antworten {
  anlass?: string
  datum?: string

  /* The readings taken at the water, part 2's first block.

     The time sits here in the PDF, which files it with part 2, while the mockup
     and the Submission model both put it in part 1. The path is the PDF's; where
     it renders is ours, so uhrzeit is the one key in this group that section 1
     shows.

     project-overview.md calls the temperature wassertemperatur. The legacy path
     is temperatur, and coding-standards.md makes the legacy path the name. */
  messdaten?: {
    uhrzeit?: string
    temperatur?: string
    leitfaehigkeit?: string
    sichttiefe?: string
    regenfaelle?: string
    truebung?: string
    schaumbildung?: string
  }

  /* The z. group looks like FiaKa bookkeeping rather than survey data: none of
     it appears in the data model in project-overview.md. Included by decision on
     2026-09-01, pending confirmation from FFS that surveyors fill it in. */
  z?: {
    rp?: string
    quelle?: string
    ps_nummer?: string
  }

  bearbeiter?: {
    name?: string
    firma?: string
    strasse?: string
    plz?: string
    /* Not in the PDF, which has a street and a postcode but no town. Both the
       mockup and the Person model have one, so it is added here and is on the
       list to raise with FFS. */
    ort?: string
    telefon?: string
    email?: string
  }

  /* How the water itself behaves along the stretch, part 2's second block.

     Nine judgements plus two estimates, all of them bands rather than
     measurements, which is why each is a code and not a number. The four "Ja"
     keys are checkboxes qualifying the group above them.

     Every group in the legacy form carries a further value, 0, meaning hydrology
     does not apply to this water. It is never offered as an option. Feature 5b
     writes it when the Gewaessertyp is a standing water. */
  hydrologie?: {
    breite?: string
    breite_schaetzwert?: string
    tiefe?: string
    tiefe_schaetzwert?: string
    tiefenvarianz?: string
    mit_flachstellen?: string
    mit_gumpen?: string
    linienfuehrung?: string
    furkationen?: string
    stroemung?: string
    rueckstroemung?: string
    fliessgeschwindigkeit?: string
    wasserfuehrung?: string
    stillwasserbereich?: string
    gesamtprofil?: string
  }

  /* How the land around the stretch is used, part 3's first block.

     Eight shares that must add up to 100, which is feature 6b's rule. A share
     is a string like every other answer here: a number input holds "5"
     mid-typing and "" when cleared, and neither is a number. */
  umland?: {
    nadelwald?: string
    mischwald?: string
    laubwald?: string
    auwald?: string
    wiese?: string
    kulturland_acker?: string
    feuchtgebiet_moor?: string
    siedlungsgebiet?: string
  }

  /* The bank, part 3's second block.

     Three percentage runs that each total 100 on their own: the four Neigung
     shares, the nine Uferbewuchs shares and the eight Uferverbauung shares.
     Around them sit answers that belong to no run and are never added up.

     Two names are worth reading twice. neigung is not the four-way Neigung run
     above it; it is the single slope of the geschütteter Damm, in degrees.
     drahtnetze is the bank's, and has a counterpart on the bed under
     gewaessersohle.drahtnetze_sohlverbauung. Both are the legacy paths. */
  ufer?: {
    randstreifen?: string

    flachufer?: string
    schraegufer?: string
    abbruch?: string
    unterspuelung?: string

    streckenanteil_geschuetteter_damm?: string
    /** Degrees, the slope of the geschütteter Damm. Not the run above. */
    neigung?: string
    buhnenbereich?: string
    wurzeln?: string

    ohne_bewuchs?: string
    graeser?: string
    schilf_rohr?: string
    krautige_blattpflanzen?: string
    straeucher?: string
    weiden?: string
    erlen?: string
    andere_baeume?: string
    sonstiger_bewuchs?: string
    /** What that last share was. The printed form leaves a writing line. */
    sonstiger_bewuchs_text?: string

    uferverbau_keiner?: string
    mauer_unverfugt?: string
    faschinen?: string
    drahtnetze?: string
    ueberwachsen?: string
    mauer_verfugt?: string
    steinwurf?: string
    sonstiger_uferverbau?: string
    sonstiger_uferverbau_text?: string
  }

  /* The bed, part 3's third block.

     Two percentage runs, the eight Substrat shares and the six Sohlverbauung
     shares, then four Besonderheiten that are ticked rather than shared out. */
  gewaessersohle?: {
    schlamm?: string
    lehm?: string
    sonstiges_erdreich?: string
    sand?: string
    kies?: string
    grobkies?: string
    steine?: string
    felsen?: string

    keine_sohlverbauung?: string
    rasensteine?: string
    drahtnetze_sohlverbauung?: string
    steinschuettung?: string
    pflasterung?: string
    betonschale?: string

    kolmatierte_sohle?: string
    eisenocker?: string
    treibsand?: string
    faulschlamm?: string
  }

  probestrecke?: {
    gewaesser?: {
      gewaessername?: string
      vorfluter1?: string
      vorfluter2?: string
      vorfluter3?: string
      vorfluter4?: string
      vorfluter5?: string
    }
    ortsangabe?: string
    gewaessertyp?: string
    laenge?: string
    monitoringnummer?: string
    /* untere and obere describe where each boundary of the stretch actually is,
       in words, beside the coordinates that fix it. */
    untere?: string
    utm_rw_unten?: string
    utm_hw_unten?: string
    obere?: string
    utm_rw_oben?: string
    utm_hw_oben?: string
  }
}

/* A path into Antworten that addresses one answer rather than a group, so a
   field component cannot be pointed at "bearbeiter" and silently write an object
   where a string belongs. */
export type AntwortPfad = FieldPathByValue<Antworten, string | undefined>

export interface Entwurf {
  id: string
  formVersion: string
  angelegtAm: string
  geaendertAm: string
  antworten: Antworten
}
