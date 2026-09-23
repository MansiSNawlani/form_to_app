/* The three calls a protocol needs while it is being filled in.
 *
 * Feature 3a put drafts on the server and 3b brought the form to them, replacing
 * the localStorage store that lived here until then. A draft now belongs to an
 * account rather than to a browser, so it survives a different machine, cleared
 * site data, and eventually reaches FFS.
 *
 * Thin on purpose. Every one of these is a path, a method and a type: the cookie,
 * the JSON, and turning a refusal into a typed error are all api/client.ts's job,
 * and deciding what to do about a failure is the caller's. Keeping them here
 * rather than inline in a component is what stops a fetch appearing in a screen.
 *
 * fetchImpl travels through so the tests need no browser and no stubbed global,
 * the same arrangement api/client.ts already uses.
 */

import { apiAnfrage } from '../../api/client'
import type {
  AbsendenAntwort,
  AbsendenAnfrage,
  Antworten,
  AntwortenSpeichern,
  EingelesenesProtokoll,
  Entwurf,
  SpeicherAntwort,
  Uebersicht,
} from './typen'

const PFAD = '/protokolle'

interface MitFetch {
  fetchImpl?: typeof fetch
}

/* Start a protocol.
 *
 * No request body. A protocol is filled in over several sittings, so it begins
 * empty and everything about it arrives through later saves. The whole draft
 * comes back rather than only its id, which is what lets the form open without a
 * second request for a document we already know is empty.
 */
export function legeEntwurfAn({ fetchImpl }: MitFetch = {}): Promise<Entwurf> {
  return apiAnfrage<Entwurf>(PFAD, { methode: 'POST', fetchImpl })
}

/* This account's own protocols, most recently worked on first.
 *
 * Summaries rather than whole protocols, and no parameters at all. The endpoint
 * filters on the caller's own id and takes no filter or page arguments: sorting,
 * searching and paging belong to feature 12's review queue, which reads across
 * every account rather than one person's handful.
 */
export function listeProtokolle({ fetchImpl }: MitFetch = {}): Promise<Uebersicht[]> {
  return apiAnfrage<Uebersicht[]>(PFAD, { fetchImpl })
}

/* One protocol in full, answers included.
 *
 * Answers PROTOKOLL_NICHT_GEFUNDEN for somebody else's protocol exactly as it
 * does for one that does not exist. That is the backend's deliberate choice, not
 * an omission, so nothing here should soften it into "no permission".
 */
export function holeEntwurf(id: string, { fetchImpl }: MitFetch = {}): Promise<Entwurf> {
  return apiAnfrage<Entwurf>(`${PFAD}/${encodeURIComponent(id)}`, { fetchImpl })
}

interface SpeicherAnfrage extends MitFetch {
  id: string
  /** The version the form is working from, not the one it hopes to write. */
  version: number
  antworten: Antworten
}

/* Save a draft's answers.
 *
 * PUT, because this replaces the document rather than merging into it: a save
 * carries every answer the form holds, so an answer left out is an answer the
 * surveyor cleared.
 *
 * Rejects with PROTOKOLL_VERAENDERT when the protocol has moved on since the
 * version given, and nothing is written. The caller has to handle that
 * differently from an ordinary failure, because trying again cannot help.
 */
export function speichereAntworten({
  id,
  version,
  antworten,
  fetchImpl,
}: SpeicherAnfrage): Promise<SpeicherAntwort> {
  const koerper: AntwortenSpeichern = { version, antworten }

  return apiAnfrage<SpeicherAntwort>(`${PFAD}/${encodeURIComponent(id)}/antworten`, {
    methode: 'PUT',
    koerper,
    fetchImpl,
  })
}

/* Throw a draft away.
 *
 * Drafts only. A submitted protocol is a record somebody else is working with,
 * and taking it back is a workflow step for feature 11 rather than a delete; the
 * backend refuses anything else with a 409.
 *
 * Nothing comes back, and nothing is undone. Asking first is the screen's job,
 * which is why there is no confirmation flag here for a caller to forget.
 */
export function loescheEntwurf(id: string, { fetchImpl }: MitFetch = {}): Promise<void> {
  return apiAnfrage<void>(`${PFAD}/${encodeURIComponent(id)}`, {
    methode: 'DELETE',
    fetchImpl,
  })
}

/* Send a finished protocol to FFS.
 *
 * POST to a sub-path rather than a PATCH setting the status, because this is an
 * action and not an edit: the rules run, the Probestrecke and the Person are
 * matched or created, seven columns are promoted out of the answers, and the
 * protocol stops being editable.
 *
 * Rejects with PROTOKOLL_UNVOLLSTAENDIG, carrying every unfinished or broken
 * answer on the error's verstoesse, when the protocol is not ready. That is the
 * one refusal a surveyor can put right by typing, and it is what the panel on
 * the form draws. PROTOKOLL_VERAENDERT and PROTOKOLL_NICHT_MEHR_ENTWURF are
 * conflicts, exactly as they are for a save.
 */
export function absendeProtokoll({
  id,
  version,
  fetchImpl,
}: AbsendenAnfrage & MitFetch & { id: string }): Promise<AbsendenAntwort> {
  const koerper: AbsendenAnfrage = { version }

  return apiAnfrage<AbsendenAntwort>(`${PFAD}/${encodeURIComponent(id)}/absenden`, {
    methode: 'POST',
    koerper,
    fetchImpl,
  })
}

/* Read a protocol out of the legacy Acrobat form and open it as a draft.
 *
 * The one call on this module that starts a protocol from something other than
 * an empty document. A surveyor who would rather fill the PDF in on a laptop in
 * a field office should not have to type the whole thing again because the
 * reviewers at FFS now work in the application, and this is that path.
 *
 * multipart/form-data, the one case where the browser must set Content-Type
 * itself, because the boundary in the header has to match the one it invented
 * for the body. api/client.ts leaves a FormData alone for exactly that reason.
 *
 * **Nothing is checked here before sending.** No size, no type, no peek at the
 * bytes. Whether a PDF is this form is something only the server can know, it
 * answers with a sentence saying what to do about it, and a second opinion in
 * the browser could only ever be the wrong one.
 *
 * Rejects with an ApiFehler whose nachricht is the backend's own German: not a
 * PDF, locked with a password, no form in it, not this form, no version stamp,
 * or too big. None of those are branched on, so none has a constant in
 * api/fehler.ts, exactly as the attachment refusals do not: every one arrives
 * with a sentence that already names the file, says why and says what to do.
 */
export function leseProtokollEin({
  datei,
  fetchImpl,
}: MitFetch & { datei: File }): Promise<EingelesenesProtokoll> {
  const koerper = new FormData()
  /* The filename travels as the third argument rather than being left to the
     File, so it is the name the surveyor picked: the refusals name the file back
     to them, and a request with no name at all makes the backend say "die Datei"
     instead. It is stored as data and never as a path. */
  koerper.append('datei', datei, datei.name)

  return apiAnfrage<EingelesenesProtokoll>(`${PFAD}/einlesen`, {
    methode: 'POST',
    koerper,
    fetchImpl,
  })
}
