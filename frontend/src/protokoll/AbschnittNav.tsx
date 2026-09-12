import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import AbschnittMenu from './AbschnittMenu'
import { ABSCHNITTE, abschnittPfad } from './abschnitte'
import { offeneJeAbschnitt } from './absenden/gruppierung'
import { useErledigtePfade } from './absenden/useErledigte'
import type { Verstoss } from '../api/typen'

interface AbschnittNavProps {
  entwurfId: string
  aktuelleNr: number
  /* What the last submit was refused for. Empty until somebody presses Absenden,
     which is why the bar carries no markers on a protocol nobody has tried to
     send yet. */
  verstoesse: readonly Verstoss[]
}

/* The step bar. Every section is a real link, so all of them are reachable in
   any order, by mouse and by keyboard, and each one can be bookmarked.

   Two shapes, swapped by a media query in protokoll.css: this bar down to about
   1200px, and AbschnittMenu below that, where seven cells stop fitting. Both
   are rendered and one is display: none, which keeps the hidden one out of the
   accessibility tree too, so a screen reader never finds two copies.

   It is an ordered list inside a nav landmark because the sections are numbered
   and their order is meaningful, even though following it is not required.
   aria-current="step" is what tells a screen reader which one is open; the
   colour and the underline only say it to people who can see them.

   Since 2026-09-12 it also carries how many problems each section still has, so
   that the panel above the form can list only the open section's and somebody can
   still see where the rest are. The count is a number and not only a colour,
   which is what makes it readable to a colour-blind surveyor, and it is repeated
   in words for a screen reader because "3" beside a section name is not a
   sentence.

   The subscription lives here rather than in ProtokollFormular deliberately: this
   bar is a sibling of the open section, so redrawing it on a keystroke costs
   seven links rather than the 312 controls of the catch table. */
function AbschnittNav({ entwurfId, aktuelleNr, verstoesse }: AbschnittNavProps) {
  const { t } = useTranslation()
  const erledigt = useErledigtePfade(verstoesse)
  const offen = offeneJeAbschnitt(verstoesse, erledigt)

  return (
    <>
      <nav className="steps" aria-label={t('protokoll.abschnitte.navLabel')}>
        <ol className="steps__list">
          {ABSCHNITTE.map((abschnitt) => {
            const aktuell = abschnitt.nr === aktuelleNr
            const offeneHier = offen.get(abschnitt.nr) ?? 0
            return (
              <li
                key={abschnitt.nr}
                className={`steps__item${aktuell ? ' steps__item--current' : ''}`}
              >
                <NavLink
                  className="steps__link"
                  to={abschnittPfad(entwurfId, abschnitt.nr)}
                  aria-current={aktuell ? 'step' : undefined}
                >
                  <span className="steps__num">{abschnitt.nr}</span>
                  <span className="steps__label">{t(abschnitt.titelKey)}</span>
                  {offeneHier > 0 && (
                    <span className="steps__offen">
                      {offeneHier}
                      <span className="sr-only">
                        {' '}
                        {t('protokoll.absenden.probleme.offenImAbschnitt', {
                          count: offeneHier,
                        })}
                      </span>
                    </span>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ol>
      </nav>

      <AbschnittMenu
        entwurfId={entwurfId}
        aktuelleNr={aktuelleNr}
        offeneProbleme={offen}
      />
    </>
  )
}

export default AbschnittNav
