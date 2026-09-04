import { useTranslation } from 'react-i18next'
import { BESATZZEILEN } from './bloecke'
import FeldSuche from '../../felder/FeldSuche'
import FeldText from '../../felder/FeldText'

/* What has been stocked into the stretch, and when.

   Four rows, because the printed form has four. Each is its own fieldset with a
   legend naming the row, which is what lets all four use the same three short
   labels: a screen reader reaching the third year field announces "Besatz 3,
   Jahr" rather than the fourth identical "Jahr" on the page. The same reason
   ProzentGruppe gives a legend to each run in section 3.

   The printed form puts rows 1 and 2 in a left column and 3 and 4 in a right
   one. Four rows top to bottom reads better on a screen, and it is the shape
   feature 9's catch table will need anyway.

   Fischart is a search rather than a dropdown: besatz_fischart has 77 entries,
   which is past the point where scrolling a list beats typing three letters. */
function BesatzZeilen() {
  const { t } = useTranslation()

  return (
    <fieldset className="form-block">
      <legend>{t('protokoll.abschnitt4.bewirtschaftung.besatz.legend')}</legend>

      {BESATZZEILEN.map(({ nr, fischart, groessenklassen, jahr }) => (
        <fieldset key={nr} className="form-row">
          <legend>
            {t('protokoll.abschnitt4.bewirtschaftung.besatz.zeile', { nr })}
          </legend>
          <div className="grid">
            <FeldSuche
              name={fischart}
              liste="besatz_fischart"
              labelKey="protokoll.abschnitt4.bewirtschaftung.besatz.feld.fischart"
              spalten={5}
            />
            <FeldText
              name={groessenklassen}
              labelKey="protokoll.abschnitt4.bewirtschaftung.besatz.feld.groessenklassen"
              spalten={4}
            />
            <FeldText
              name={jahr}
              labelKey="protokoll.abschnitt4.bewirtschaftung.besatz.feld.jahr"
              spalten={3}
            />
          </div>
        </fieldset>
      ))}
    </fieldset>
  )
}

export default BesatzZeilen
