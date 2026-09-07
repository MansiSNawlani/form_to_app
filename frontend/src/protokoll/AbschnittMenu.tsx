import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ABSCHNITTE, abschnittPfad } from './abschnitte'

interface AbschnittMenuProps {
  entwurfId: string
  aktuelleNr: number
}

/* The section navigation on a narrow screen, where the seven-cell bar does not
 * fit.
 *
 * One line saying where you are, and a dropdown to go somewhere else. The line
 * is the point: a bar reduced to bare numbers would fit too, but on exactly the
 * devices that need it there is no hover, so nothing could ever tell a surveyor
 * what number 4 holds. This says it outright and costs one line either way.
 *
 * A Menu of links rather than a Select. The seven sections are places, not
 * values, and the full bar has always made them real links so that any section
 * can be opened, bookmarked or opened in a new tab at any time; a Select would
 * quietly drop all of that on small screens only. Menu also behaves for
 * keyboards on its own: arrow keys, Escape, and focus returning to the button.
 *
 * Rendered alongside the full bar and swapped by a media query rather than by
 * measuring the window in JavaScript. display: none takes the hidden one out of
 * the accessibility tree as well as off the screen, so there is never a second
 * copy of these links for a screen reader to find.
 */
function AbschnittMenu({ entwurfId, aktuelleNr }: AbschnittMenuProps) {
  const { t } = useTranslation()
  const menuId = useId()
  const [anker, setAnker] = useState<HTMLElement | null>(null)
  const offen = anker !== null

  const aktuell = ABSCHNITTE.find((abschnitt) => abschnitt.nr === aktuelleNr)

  return (
    <nav className="steps-kompakt" aria-label={t('protokoll.abschnitte.navLabel')}>
      <Button
        className="steps-kompakt__knopf"
        variant="outlined"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? menuId : undefined}
        onClick={(event) => setAnker(event.currentTarget)}
      >
        <span className="steps-kompakt__zaehler">
          {t('protokoll.abschnitte.abschnittVon', {
            nr: aktuelleNr,
            anzahl: ABSCHNITTE.length,
          })}
        </span>
        <span className="steps-kompakt__titel">
          {aktuell === undefined ? '' : t(aktuell.titelKey)}
        </span>
      </Button>

      <Menu
        id={menuId}
        anchorEl={anker}
        open={offen}
        onClose={() => setAnker(null)}
        /* As wide as the button it drops from, so the seven titles are not
           squeezed into a narrow popup beside a full-width control. */
        slotProps={{ paper: { className: 'steps-kompakt__liste' } }}
      >
        {ABSCHNITTE.map((abschnitt) => (
          <MenuItem
            key={abschnitt.nr}
            component={Link}
            to={abschnittPfad(entwurfId, abschnitt.nr)}
            selected={abschnitt.nr === aktuelleNr}
            /* Marks the open section for a screen reader. selected only tints
               it, which says nothing to anyone not looking at the screen. */
            aria-current={abschnitt.nr === aktuelleNr ? 'step' : undefined}
            onClick={() => setAnker(null)}
          >
            <span className="steps-kompakt__num">{abschnitt.nr}</span>
            {t(abschnitt.titelKey)}
          </MenuItem>
        ))}
      </Menu>
    </nav>
  )
}

export default AbschnittMenu
