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

  const form = useForm<Antworten>({ defaultValues: entwurf.antworten })
  const saveState = useAutoSave(entwurf, form)

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
    <>
      <ProtokollKopf entwurf={entwurf} saveState={saveState} />
      <AbschnittNav entwurfId={entwurf.id} aktuelleNr={abschnitt.nr} />

      <section className="card" ref={card} tabIndex={-1} aria-label={titel}>
        {/* No onSubmit: there is nothing to submit until feature 11, and saving
            is automatic. The form element is here for the semantics and so that
            the fields sit inside one. */}
        <FormProvider {...form}>
          <form>
            <AbschnittInhalt abschnitt={abschnitt} titel={titel} />
          </form>
        </FormProvider>

        <AbschnittWechsel
          entwurfId={entwurf.id}
          aktuelleNr={abschnitt.nr}
          saveState={saveState}
        />
      </section>
    </>
  )
}

export default ProtokollFormular
