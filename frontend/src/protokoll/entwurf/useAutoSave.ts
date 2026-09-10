import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { ApiFehler, PROTOKOLL_VERAENDERT } from '../../api/fehler'
import { legeEntwurfAn, speichereAntworten } from './api'
import { NEU, istNeu } from './neu'
import { sicherungsStore } from './sicherung'
import type { Antworten, Entwurf } from './typen'

/* Saving is automatic and its state is always visible, which project-overview.md
 * makes a requirement rather than a nicety: the protocol is long, it is filled in
 * over several sittings, and a surveyor has to be able to close the laptop
 * mid-section and trust that the work is there tomorrow.
 *
 * Feature 3b moved the destination from this browser to the server, which gave
 * saving two failure modes it never had. It may not arrive, which the local
 * safety copy answers, and it may be refused because the protocol moved on
 * somewhere else, which is the conflict below.
 */

/* A union rather than a status beside a nullable timestamp, so "saved" always
   carries the moment it was saved and the indicator has no absent case to invent
   a value for. */
export type SaveState =
  | { status: 'unchanged' }
  /* Opened but not yet written to the server, because nothing has been typed
     into it. Its own state rather than 'unchanged', which would claim there is
     a record and it matches: there is no record at all. */
  | { status: 'ungespeichert' }
  | { status: 'saving' }
  | { status: 'saved'; zeitpunkt: string }
  | { status: 'failed' }
  /* The protocol was changed somewhere else, so the server refused this save and
     wrote nothing. Its own state rather than a kind of 'failed', because it is
     the one failure where trying again cannot help and the person has to do
     something. */
  | { status: 'conflict' }

export interface AutoSave {
  zustand: SaveState
  /** Save now rather than at the end of the debounce. The restore banner's. */
  jetztSpeichern: () => void
}

export interface AutoSaveOptionen {
  /* Called once, when a protocol that had no record gets one. The page uses it
     to put the new draft in the cache and to swap the address bar from
     /protokolle/neu to the real id, so a reload lands on the protocol rather
     than on a fresh empty one. */
  onAngelegt?: (entwurf: Entwurf) => void
}

/* Long enough that typing a word is one save and not eight, short enough that
   nobody navigates away in the gap. The unmount flush covers that gap anyway. */
const DEBOUNCE_MS = 800

/* One shared object, not a fresh one per keystroke, and this is a performance
 * fix rather than tidiness.
 *
 * setState re-renders whenever the new value is not Object.is-equal to the old
 * one, so a literal here made every keystroke re-render ProtokollFormular, and
 * with it the whole open section under FormProvider. Through parts 1 to 5 that
 * cost nothing worth measuring. Part 6 puts 312 controls on one screen, 26 of
 * them Autocompletes over a 123 entry species list, and the same re-render came
 * to 206ms per keystroke: measured on 2026-09-04 with all 26 catch rows filled,
 * which is the sticky typing coding-standards.md chose React Hook Form to avoid.
 *
 * Reusing the object lets React bail out, so the second and later keystrokes of
 * a burst re-render nothing at all. The indicator already reads "wird
 * gespeichert" by then and has nothing new to say. */
const SPEICHERT: SaveState = { status: 'saving' }
const UNGESPEICHERT: SaveState = { status: 'ungespeichert' }
const KONFLIKT: SaveState = { status: 'conflict' }
const FEHLGESCHLAGEN: SaveState = { status: 'failed' }

/* What a failed save means, apart from the hook, so it can be tested without
 * React and without a browser: the same arrangement auth/useSitzung.ts uses for
 * sitzungAus, and for the same reason. A wrong answer here is possible and
 * costly. Reporting a conflict as an ordinary failure would leave somebody
 * waiting for a retry that is never going to succeed, and reporting an
 * unreachable server as a conflict would send them hunting for a second tab
 * that does not exist.
 */
export function fehlerZustand(fehler: unknown): SaveState {
  const veraendert = fehler instanceof ApiFehler && fehler.code === PROTOKOLL_VERAENDERT
  return veraendert ? KONFLIKT : FEHLGESCHLAGEN
}

/* The call is made directly rather than through useMutation, and that is a
 * deliberate departure from coding-standards.md's "TanStack Query for server
 * calls, including the automatic save".
 *
 * useMutation subscribes its component to the mutation's own state, so every
 * save would re-render ProtokollFormular twice more: once on pending and once on
 * settling. That is the same re-render the SPEICHERT constant above exists to
 * avoid, measured at 206ms on the catch table, and it would land every time
 * somebody pauses typing. Nothing useMutation offers is wanted here either:
 * there is no cache entry to update, and retrying a refused save automatically
 * is precisely what must not happen.
 *
 * Reading a protocol does go through useQuery, in ProtokollSeite, where the
 * cache and the loading state are worth having.
 */
export function useAutoSave(
  entwurf: Entwurf,
  form: UseFormReturn<Antworten>,
  { onAngelegt }: AutoSaveOptionen = {},
): AutoSave {
  const [state, setState] = useState<SaveState>(
    istNeu(entwurf.id) ? UNGESPEICHERT : { status: 'unchanged' },
  )

  /* The protocol this hook is saving to, which is not always the one it was
     handed. A protocol opened from "Neues Protokoll" has no record until the
     first thing is typed into it, so its id arrives mid-life from the server. A
     ref rather than state for the same reason the version below is one: saving
     must not re-render the form, and the flush on unmount has to see the
     current value rather than the one captured when the effect ran. */
  const id = useRef(entwurf.id)

  /* The version the next save will claim to be working from. A ref rather than
     state because saving must not re-render the form, and because the flush on
     unmount has to see the current value rather than the one captured when the
     effect ran. Send a stale one and the server refuses with a 409. */
  const version = useRef(entwurf.version)

  /* Set by the effect below, so the banner can ask for a save without the
     debounce, and reset on unmount so a late click cannot reach a dead closure. */
  const anstossen = useRef<() => void>(() => {})

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false
    /* One save at a time. A second request sent while the first is still open
       would carry the version the first is about to spend, so the server would
       refuse it as a conflict: the tab would be told it had collided with
       itself. Anything typed meanwhile is caught by the re-fire below. */
    let laeuft = false
    /* Set once the server has refused a save as a conflict. Every later save
       would carry the same stale version and be refused the same way, so trying
       is worse than useless: it would keep overwriting the conflict message with
       another one and hide the only thing worth reading. */
    let aufgegeben = false

    /* Keep what is on screen, without sending anything.
     *
     * Written before the request rather than after it fails, which is what makes
     * it cover a shut laptop and a killed tab as well as a refusal, and it is
     * also the whole of what happens once a conflict has stopped the saving. The
     * copy is cleared only when the server has confirmed a save, so a copy that
     * is still here always means work the server never acknowledged. */
    function sichern(): void {
      sicherungsStore.schreib({
        id: id.current,
        version: version.current,
        antworten: form.getValues(),
      })
    }

    async function save(report: boolean): Promise<void> {
      if (!pending || laeuft || aufgegeben) return
      pending = false
      laeuft = true

      const antworten = form.getValues()
      sichern()

      try {
        /* The first thing typed into a protocol is what brings it into
           existence. Two requests rather than one, because POST takes no body:
           a protocol begins empty and everything about it arrives through
           saves, which is the shape feature 3a settled on and not worth
           reopening for this one moment. */
        if (istNeu(id.current)) {
          const angelegt = await legeEntwurfAn()
          id.current = angelegt.id
          version.current = angelegt.version
          // Written under the placeholder id a moment ago, and pointing at a
          // protocol that now has a real one.
          sicherungsStore.loesche(NEU)
          onAngelegt?.({ ...angelegt, antworten })
        }

        const antwort = await speichereAntworten({
          id: id.current,
          version: version.current,
          antworten,
        })
        version.current = antwort.version
        sicherungsStore.loesche(id.current)
        if (report) setState({ status: 'saved', zeitpunkt: antwort.updated_at })
      } catch (fehler) {
        /* The copy is deliberately left where it is on every path out of here.
           It is the only place what was typed still exists. */
        const zustand = fehlerZustand(fehler)

        if (zustand.status === 'conflict') {
          /* Reported even on the silent unmount flush. The state outlives this
             component: navigating back into the protocol must not find the loop
             quietly retrying a save that can only be refused again. */
          aufgegeben = true
          setState(zustand)
        } else if (report) {
          setState(zustand)
        }
      } finally {
        laeuft = false
        // Typed while that request was open, so what is on screen is not yet
        // saved and nothing else is going to notice.
        if (pending) void save(report)
      }
    }

    const subscription = form.watch(() => {
      pending = true
      clearTimeout(timer)

      /* After a conflict no request is sent, but everything typed from here on
         still has to be kept: the panel on screen tells the surveyor their
         entries are safe in this browser and offers to reload the page, and
         that promise is only true if this keeps running. Without it, everything
         typed between the conflict and the reload would go silently. */
      if (aufgegeben) {
        timer = setTimeout(sichern, DEBOUNCE_MS)
        return
      }

      setState(SPEICHERT)
      timer = setTimeout(() => void save(true), DEBOUNCE_MS)
    })

    anstossen.current = () => {
      if (aufgegeben) return
      pending = true
      setState(SPEICHERT)
      clearTimeout(timer)
      void save(true)
    }

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
      anstossen.current = () => {}

      /* Leaving the page inside the debounce window must not lose the last
         change. Reporting state on the way out would be a write to a component
         that is going away, so this flush is silent. The request may well
         outlive the page, which is exactly why the copy is written before it is
         sent rather than after it fails.
         After a conflict there is no request to make, and the copy is all there
         is, so it is taken directly. */
      if (!pending) return
      if (aufgegeben) sichern()
      else void save(false)
    }
    /* entwurf.id is deliberately not a dependency, unlike every other value
       this effect reads. The page hands the same draft object over for as long
       as it is open, so the id only ever changes in the ref above, from the
       placeholder to the one the server gave. Re-running on that would tear
       down the subscription and flush a save against the id it had just
       replaced. onAngelegt is left out for the same reason and runs at most
       once. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const jetztSpeichern = useCallback(() => anstossen.current(), [])

  return { zustand: state, jetztSpeichern }
}
