import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import AbschnittNav from './AbschnittNav'
import AbschnittWechsel from './AbschnittWechsel'
import ProtokollKopf from './ProtokollKopf'
import AbschnittInhalt from './abschnitte/AbschnittInhalt'
import type { Abschnitt } from './abschnitte'
import SpeicherProblem from './SpeicherProblem'
import SicherungAngebot from './entwurf/SicherungAngebot'
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
  const { zustand: saveState, jetztSpeichern } = useAutoSave(entwurf, form, { onAngelegt })
  useHydrologieAbgleich(form)

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
      <ProtokollKopf entwurf={entwurf} saveState={saveState} />
      <AbschnittNav entwurfId={entwurf.id} aktuelleNr={abschnitt.nr} />

      {/* Above the section rather than inside it: the offer is about the whole
          protocol, and it has to be seen whichever section the URL opened on. */}
      <SicherungAngebot entwurf={entwurf} form={form} jetztSpeichern={jetztSpeichern} />
      <SpeicherProblem saveState={saveState} />

      <section className="card" ref={card} tabIndex={-1} aria-label={titel}>
        {/* No onSubmit: there is nothing to submit until feature 11, and saving
            is automatic. The form element is here for the semantics and so that
            the fields sit inside one. */}
        <form>
          <AbschnittInhalt abschnitt={abschnitt} entwurfId={entwurf.id} />
        </form>

        <AbschnittWechsel
          entwurfId={entwurf.id}
          aktuelleNr={abschnitt.nr}
          saveState={saveState}
        />
      </section>
    </FormProvider>
  )
}

export default ProtokollFormular
