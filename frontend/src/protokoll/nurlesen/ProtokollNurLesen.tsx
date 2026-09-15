import Typography from '@mui/material/Typography'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { NurLesenKontext } from './kontext'
import { ABSCHNITTE } from '../abschnitte'
import { ABSCHNITTSKOERPER } from '../abschnitte/koerper'
import type { Antworten } from '../entwurf/typen'

/* The protocol as filed, section by section, with nothing to type into.
 *
 * The section components are reused rather than rewritten, and that is the whole
 * design. Each of the 338 fields already knows its label, its width, its hint
 * and where it sits among its neighbours, and all of that lives inside 26 block
 * components. A separate read-only page would have to restate every bit of it,
 * and the copy would drift from the form the first time a label changed.
 *
 * So the blocks are untouched and the **field** components learn a second way to
 * draw themselves, which the context above them switches on. Steps 5 to 8 add
 * that branch one family of controls at a time; until then the fields here still
 * render as controls, which is expected and is what makes each of those steps
 * visible.
 *
 * All six on one page rather than one at a time behind the step bar. A reviewer
 * reads a protocol through, and a decision about the whole of it should not
 * require remembering six screens.
 */

/* What this page does **not** mount, which matters more than what it does.
 *
 * 1. No resolver, and trigger is never called. No rule runs, so no red message
 *    appears. A reviewer judging a filed protocol is not being asked to correct
 *    it, and the gate deciding whether it could be submitted at all already ran
 *    at Absenden.
 * 2. No automatic save, no Absenden, no attachment upload. Nothing here writes.
 * 3. **No useHydrologieAbgleich.** That hook runs on its own, without anybody
 *    typing, and it deletes the hydrology answers whenever the Gewaessertyp says
 *    they do not apply. On a draft that is right. Here it would mean that opening
 *    a protocol to read it rewrites what somebody filed two months ago. The case
 *    where it really bites is feature 23's imports: the legacy form's own version
 *    of that check tests for Gewaessertyp 31 and 32, which do not exist (defect
 *    9 in docs/ffs-defect-list.md), so it never clears anything, and an imported
 *    protocol will arrive carrying a standing-water type together with a full set
 *    of flowing-water answers.
 *
 * Section 2 still hides its hydrology block for a standing water, because that
 * decision is made while rendering out of the answers themselves. What is left
 * out is only the hook that writes.
 */
function ProtokollNurLesen({ antworten }: { antworten: Antworten }) {
  const { t } = useTranslation()

  /* React Hook Form still holds the values, so the field components read them
     exactly as they already do. Nothing subscribes to changes because nothing
     changes; the read-only branches use getValues rather than useWatch. */
  const form = useForm<Antworten>({ defaultValues: antworten })

  return (
    <NurLesenKontext value={true}>
      <FormProvider {...form}>
        {ABSCHNITTE.map((abschnitt) => {
          /* Section 7 is the attachments, and step 8 puts them here. Written as
             a narrowing check rather than a filtered list, so the six bodies are
             looked up by the same number the title comes from and the two cannot
             fall out of step. */
          const Koerper =
            abschnitt.nr === 7 ? undefined : ABSCHNITTSKOERPER[abschnitt.nr]
          if (Koerper === undefined) return null

          const nr = abschnitt.nr
          const titel = t(abschnitt.titelKey)

          return (
            <section className="card" key={nr} aria-labelledby={`abschnitt-${nr}`}>
              {/* A card each rather than one long card, so the six parts of the
                  protocol stay as distinct on the page as they are in the step
                  bar a surveyor filled them in through. */}
              <Typography
                variant="h2"
                component="h2"
                id={`abschnitt-${nr}`}
                className="abschnitt-karte__titel"
              >
                {titel}
              </Typography>
              <Koerper />
            </section>
          )
        })}
      </FormProvider>
    </NurLesenKontext>
  )
}

export default ProtokollNurLesen
