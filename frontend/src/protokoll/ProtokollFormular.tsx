import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import AbschnittNav from './AbschnittNav'
import AbschnittWechsel from './AbschnittWechsel'
import ProtokollKopf from './ProtokollKopf'
import AbschnittInhalt from './abschnitte/AbschnittInhalt'
import type { Abschnitt } from './abschnitte'
import SpeicherProblem from './SpeicherProblem'
import SicherungAngebot from './entwurf/SicherungAngebot'
import AbsendeErgebnis from './absenden/AbsendeErgebnis'
import { useAbsenden } from './absenden/useAbsenden'
import { erstelleBereitsteller } from './entwurf/bereitstellen'
import { anzeigeZustand, type Anlagenzustand } from './entwurf/speicherzustand'
import { legeEntwurfAn } from './entwurf/api'
import { useAutoSave } from './entwurf/useAutoSave'
import type { Antworten, Entwurf } from './entwurf/typen'
import { antwortenSchema } from './regeln/schema'
import { useHydrologieAbgleich } from './regeln/useHydrologieAbgleich'

interface ProtokollFormularProps {
  entwurf: Entwurf
  abschnitt: Abschnitt
  /** Passed straight to the automatic save: fired once, when a protocol that
      had no record on the server gets one. */
  onAngelegt?: (entwurf: Entwurf) => void
}

/* One protocol: the head, the step bar, the open section and the action row.
 *
 * The form spans every section rather than one form per section, because the
 * answers are one document and switching section must not discard what is not
 * yet saved. React Hook Form holds the values, so typing in a 338 field form
 * re-renders the field and not the page; coding-standards.md rules out useState
 * or a context here for exactly that reason. */
function ProtokollFormular({ entwurf, abschnitt, onAngelegt }: ProtokollFormularProps) {
  const { t } = useTranslation()

  /* onTouched, so a fresh draft says nothing until somebody has actually been
     in a field. The asterisks mark what is needed to submit, which is feature
     11's gate; the rules only speak up about an answer that is wrong.

     Validity never reaches useAutoSave. A half-finished protocol is the normal
     state of this form and is saved exactly as typed. */
  const form = useForm<Antworten>({
    defaultValues: entwurf.antworten,
    mode: 'onTouched',
    resolver: zodResolver(antwortenSchema),
  })
  /* The id this protocol really has, which is not always the one it was handed.
   *
   * A protocol opened from "Neues Protokoll" has no record until something is
   * put into it, and the page deliberately keeps this component mounted when
   * that happens, so nothing is torn down mid-keystroke. The consequence is that
   * the entwurf prop goes on carrying the placeholder id for the rest of the
   * visit, and anything addressed by protocol id, which since feature 3d means
   * the attachments, has to be told the real one.
   *
   * State rather than a ref, because the blocks below have to re-render and
   * fetch their list once there is a protocol to fetch it from. */
  const [angelegteId, setAngelegteId] = useState<string | null>(null)
  const entwurfId = angelegteId ?? entwurf.id

  const beiAnlage = useCallback(
    (angelegt: Entwurf) => {
      setAngelegteId(angelegt.id)
      onAngelegt?.(angelegt)
    },
    [onAngelegt],
  )

  const { zustand: saveState, jetztSpeichern, bereitZumAbsenden } = useAutoSave(entwurf, form, {
    onAngelegt: beiAnlage,
  })
  useHydrologieAbgleich(form)

  /* Held here rather than beside the button, so it survives the navigation its
     own panel invites: every entry in that list links to another section, and a
     list held inside section 7 was destroyed by the first link somebody
     followed. Found by Mansi on 2026-09-12. */
  const absendung = useAbsenden({ entwurfId, bereitZumAbsenden })

  /* Built once for the life of the form, so both blocks in section 7 share one
     in-flight request. Two of them each checking and then creating would leave a
     surveyor with two empty protocols and their pictures split between them.

     The id is handed in at the moment of the call rather than captured here, so
     the same provider keeps working after the automatic save has created the
     record. */
  const bereitstellen = useMemo(
    () => erstelleBereitsteller({ anlegen: () => legeEntwurfAn(), onAngelegt: beiAnlage }),
    [beiAnlage],
  )

  /* What section 7 has to say about saving, which the header has to show as
     well: there is one indicator and it speaks for the whole protocol. A
     photograph on the server is work that is safe, and an indicator that only
     ever watched the answers would leave a surveyor who went straight to the
     attachments looking at "noch nicht gespeichert". Found on 2026-09-11.

     entwurf/speicherzustand.ts decides which of the two the header shows when
     both have something to say. */
  const [anlagenZustand, setAnlagenZustand] = useState<Anlagenzustand>(null)
  const saveAnzeige = anzeigeZustand(saveState, anlagenZustand)

  /* An answer that was wrong when the draft was put down is still wrong when it
     is picked up again, so the saved answers are checked once on opening.
     Without this, a reopened protocol looks clean until somebody happens to
     visit the field, and a wrong coordinate reaches the review queue unseen.

     This does not contradict staying quiet on a fresh draft. Every rule passes
     over an answer nobody has given, so a new protocol produces nothing to
     show: what appears here was caused by something actually in the document. */
  useEffect(() => {
    void form.trigger()
  }, [form])

  /* Focus follows the section change.
   *
   * Without this, activating a step link leaves focus on the step bar: a screen
   * reader user hears nothing about the section that just opened, and a keyboard
   * user has to tab back through the whole bar to reach the first field. The card
   * is labelled with the section title, so landing on it announces where you are.
   *
   * Deliberately not on first render, where focus belongs at the top of the
   * document as the browser left it. */
  const card = useRef<HTMLElement>(null)
  const previousNr = useRef<number>(undefined)
  useEffect(() => {
    if (previousNr.current !== undefined && previousNr.current !== abschnitt.nr) {
      /* preventScroll, then scroll ourselves.
       *
       * focus() scrolls its element into view by default, and a section card is
       * nearly always taller than the window. When an element is larger than the
       * scrollport the browser aligns its top edge with the top of the viewport,
       * so focusing the card pushed the site header, the page heading and the
       * step bar off the screen: choosing a section appeared to jump the page
       * down. Reported on 2026-09-07.
       *
       * Focus still has to move, for the reason above, so the fix is to keep the
       * focus and take back the scrolling. */
      card.current?.focus({ preventScroll: true })
      /* The top, not the card, so the step bar stays in sight and the section
         you just chose is visibly the one that is open. Instant rather than
         smooth: this is a navigation, and a long glide would be one more thing
         to wait for on every section change. */
      window.scrollTo({ top: 0 })
    }
    previousNr.current = abschnitt.nr
  }, [abschnitt.nr])

  const titel = t(abschnitt.titelKey)

  return (
    /* The provider wraps the head as well as the card, because the heading is
       the draft's own name and reads it out of the answers. */
    <FormProvider {...form}>
      <ProtokollKopf entwurf={entwurf} saveState={saveAnzeige} />
      <AbschnittNav
        entwurfId={entwurf.id}
        aktuelleNr={abschnitt.nr}
        verstoesse={absendung.verstoesse}
      />

      {/* Above the section rather than inside it: the offer is about the whole
          protocol, and it has to be seen whichever section the URL opened on. */}
      <SicherungAngebot entwurf={entwurf} form={form} jetztSpeichern={jetztSpeichern} />
      <SpeicherProblem saveState={saveAnzeige} />

      {/* What the last submit came back with. Above the section for the same
          reason the two banners above it are: it is about the whole protocol,
          and every entry in it links to a different section, so holding it
          inside one would destroy it the moment somebody followed a link. */}
      <AbsendeErgebnis
        entwurfId={entwurfId}
        aktuelleNr={abschnitt.nr}
        absendung={absendung}
      />

      <section className="card" ref={card} tabIndex={-1} aria-label={titel}>
        {/* No onSubmit. Submitting is a button of its own at the foot of section
            7, not this form being submitted: it sends what is already stored on
            the server rather than what is in these fields, and saving is
            automatic. The form element is here for the semantics and so that the
            fields sit inside one. */}
        <form>
          <AbschnittInhalt
            abschnitt={abschnitt}
            entwurfId={entwurfId}
            bereitstellen={bereitstellen}
            melde={setAnlagenZustand}
            absenden={absendung.absenden}
            absendenLaeuft={absendung.laeuft}
          />
        </form>

        <AbschnittWechsel
          entwurfId={entwurf.id}
          aktuelleNr={abschnitt.nr}
          saveState={saveAnzeige}
        />
      </section>
    </FormProvider>
  )
}

export default ProtokollFormular
