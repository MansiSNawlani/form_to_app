import { useMemo } from 'react'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Prozentgruppe } from './gruppen'
import { bewerteAnteile, bewerteGruppe } from '../../regeln/prozent'
import { useNurLesen } from '../../nurlesen/kontext'
import type { Antworten } from '../../entwurf/typen'

/* What a Prozentgruppe currently adds up to, under the group.
 *
 * The legacy form's device here is a red star that turns into a green tick. A
 * number is more use: "Summe: 83 %" says how far off the answer is, and a tick
 * does not.
 *
 * Judged by the same bewerteAnteile regeln/schema.ts uses, so the number on
 * screen and the document's validity cannot disagree. The message shown is the
 * one the rule actually raised, which is why a group holding something that is
 * not a number says so on that share and stays quiet about its total.
 *
 * The message waits until a share has been left, the same onTouched cadence
 * every other field on the protocol follows, or until a draft opens already
 * holding a wrong total. Objecting on the first keystroke would object to
 * normal typing: a group is under 100 all the way up to the moment it is
 * finished.
 */

interface GruppensummeProps {
  gruppe: Prozentgruppe
  /** The group's fieldset points at this with aria-describedby. */
  id: string
}

function Gruppensumme({ gruppe, id }: GruppensummeProps) {
  const { t } = useTranslation()
  const { getFieldState } = useFormContext<Antworten>()
  const nurLesen = useNurLesen()

  /* Memoised because useWatch resubscribes when the name array changes
     identity, and a fresh array every render would mean a fresh subscription
     every render. The groups are module constants, so this never recomputes. */
  const pfade = useMemo(() => gruppe.felder.map(({ pfad }) => pfad), [gruppe])

  /* Both subscriptions are scoped to this group's own shares. A wider one would
     re-render the section around it on every keystroke, which is the sticky
     typing at 338 fields that coding-standards.md picked React Hook Form to
     avoid.

     useWatch resolves a name array that is not a literal tuple to the union of
     every value in the document, groups included. AntwortPfad is by
     construction only the paths whose value is a string, so the narrowing says
     what these paths can actually hold. */
  const werte = useWatch<Antworten>({ name: pfade }) as readonly (string | undefined)[]
  const formState = useFormState<Antworten>({ name: pfade })

  const { summe, verstoesse } = bewerteAnteile(gruppe, werte)

  /* The rule's own verdict on the total, rather than a second reading of the
     number. bewerteAnteile stays quiet about a total it cannot trust, so an
     unparseable share reports on that share and not here. */
  const summenfehler = verstoesse.find(({ pfad }) => pfad === gruppe.id)

  /* A group that arrived with shares already in it is one somebody has worked
     on, so it is spoken about from the moment the draft opens. Touched state
     alone would not cover that: ProtokollFormular revalidates a loaded draft on
     mount, which sets errors but leaves every field untouched, so a protocol put
     down at 83 would have been picked up looking clean. */
  const vorbefuellt = useMemo(
    () =>
      bewerteGruppe(gruppe, (formState.defaultValues ?? {}) as Antworten).verstoesse.length >
      0,
    [gruppe, formState.defaultValues],
  )
  const angefasst = pfade.some((pfad) => getFieldState(pfad, formState).isTouched)

  /* The running total is worth reading on a filed protocol; the verdict on it is
   * not this page's to give.
   *
   * This component does not go through the resolver, so leaving it alone would
   * have been the one place a rule still spoke on the reviewer's screen: a group
   * loaded at 83 sets vorbefuellt, and the message would print in red over a
   * record somebody handed in months ago. Found by the branch review on
   * 2026-09-15.
   *
   * The number stays, since "Summe: 83 %" is a fact about the protocol. What
   * goes is the message and the colour, which are the application telling a
   * surveyor to fix something. Whether a reviewer should be shown a protocol's
   * problems, and how, is the decision panel's question and belongs to feature
   * 11f. */
  const meldung =
    !nurLesen && summenfehler && (angefasst || vorbefuellt) ? t(summenfehler.schluessel) : ''

  const vollstaendig = summe === 100 && verstoesse.length === 0
  const zustand =
    nurLesen
      ? ''
      : meldung
        ? ' group-total--wrong'
        : vollstaendig
          ? ' group-total--complete'
          : ''

  return (
    <p className={`group-total${zustand}`} id={id}>
      <span className="group-total__value">{t('protokoll.abschnitt3.summe', { summe })}</span>
      {/* Always rendered, empty when there is nothing to say. A live region that
          is added to the page at the same moment as its text is unreliably
          announced; one that is already there is not. */}
      <span className="group-total__message" role="status">
        {meldung}
      </span>
    </p>
  )
}

export default Gruppensumme
