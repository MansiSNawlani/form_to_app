import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import AbschnittNav from './AbschnittNav'
import AbschnittWechsel from './AbschnittWechsel'
import ProtokollKopf from './ProtokollKopf'
import AbschnittInhalt from './abschnitte/AbschnittInhalt'
import type { Abschnitt } from './abschnitte'
import { useAutoSave } from './entwurf/useAutoSave'
import type { Antworten, Entwurf } from './entwurf/typen'
import { antwortenSchema } from './regeln/schema'
import { useHydrologieAbgleich } from './regeln/useHydrologieAbgleich'

interface ProtokollFormularProps {
  entwurf: Entwurf
  abschnitt: Abschnitt
}

/* One protocol: the head, the step bar, the open section and the action row.
 *
 * The form spans all six sections rather than one form per section, because the
 * answers are one document and switching section must not discard what is not
 * yet saved. React Hook Form holds the values, so typing in a 338 field form
 * re-renders the field and not the page; coding-standards.md rules out useState
 * or a context here for exactly that reason. */
function ProtokollFormular({ entwurf, abschnitt }: ProtokollFormularProps) {
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
  const saveState = useAutoSave(entwurf, form)
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
      card.current?.focus()
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

      <section className="card" ref={card} tabIndex={-1} aria-label={titel}>
        {/* No onSubmit: there is nothing to submit until feature 11, and saving
            is automatic. The form element is here for the semantics and so that
            the fields sit inside one. */}
        <form>
          <AbschnittInhalt abschnitt={abschnitt} />
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
