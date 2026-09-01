import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ABSCHNITTE, abschnittPfad } from './abschnitte'

interface AbschnittNavProps {
  entwurfId: string
  aktuelleNr: number
}

/* The step bar. Every section is a real link, so all six are reachable in any
   order, by mouse and by keyboard, and each one can be bookmarked.

   It is an ordered list inside a nav landmark because the sections are numbered
   and their order is meaningful, even though following it is not required.
   aria-current="step" is what tells a screen reader which one is open; the
   colour and the underline only say it to people who can see them. */
function AbschnittNav({ entwurfId, aktuelleNr }: AbschnittNavProps) {
  const { t } = useTranslation()

  return (
    <nav className="steps" aria-label={t('protokoll.abschnitte.navLabel')}>
      <ol className="steps__list">
        {ABSCHNITTE.map((abschnitt) => {
          const aktuell = abschnitt.nr === aktuelleNr
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
              </NavLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default AbschnittNav
