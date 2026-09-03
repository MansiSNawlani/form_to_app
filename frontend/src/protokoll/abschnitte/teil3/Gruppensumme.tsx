import { useMemo } from 'react'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { Prozentgruppe } from './gruppen'
import { bewerteAnteile, bewerteGruppe } from '../../regeln/prozent'
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

  const meldung = summenfehler && (angefasst || vorbefuellt) ? t(summenfehler.schluessel) : ''

  const vollstaendig = summe === 100 && verstoesse.length === 0
  const zustand = meldung
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
