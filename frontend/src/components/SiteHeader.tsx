import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ROLLEN } from '../api/typen'
import lazbw from '../assets/lazbw.png'
import AbmeldeKnopf from '../auth/AbmeldeKnopf'
import { useSitzung } from '../auth/useSitzung'
import ThemeToggle from './ThemeToggle'

/* Two strings here are deliberately NOT in the locale file and must never be
   translated: the organisation name is a proper noun, and "Protokoll
   E-Befischung" is the name of the legacy form and a domain term, which
   coding-standards.md keeps German in every locale. Keeping them literal means
   feature 17's English pass cannot reach them by accident. */
function SiteHeader() {
  const { t } = useTranslation()
  const sitzung = useSitzung()

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          {/* Decorative, so alt is empty on purpose: the organisation's name is
              spelled out in text immediately beside it, and a screen reader
              announcing it twice helps nobody. */}
          <img className="brand__mark" src={lazbw} alt="" />
          <span className="brand__text">
            <span className="brand__org">
              Fischereiforschungsstelle Baden-Württemberg
            </span>
            <span className="brand__app">Protokoll E-Befischung</span>
          </span>
        </div>
        <div className="site-header__spacer" />
        <div className="site-header__user">
          <ThemeToggle />
          {/* Only when there is genuinely an account. While the session is still
              being checked this stays empty rather than guessing, which is the
              same reason the guard has three states rather than a boolean. */}
          {sitzung.zustand === 'angemeldet' && (
            <>
              <span className="site-header__konto">
                {/* The address, because the account has no display name. Person
                    has one, but that is the Bearbeiter who carried out the
                    survey, and they are not always the account filing it. */}
                <span className="visually-hidden">{t('sitzung.angemeldetAls')} </span>
                <strong>{sitzung.benutzer.email}</strong>
              </span>
              {/* Walked in the order ROLLEN declares rather than the order the
                  server sent, so two accounts with the same roles always read
                  the same way round. */}
              {ROLLEN.filter((rolle) => sitzung.benutzer.rollen.includes(rolle)).map((rolle) => (
                <span key={rolle} className="role-tag">
                  {t(`common.rollen.${rolle}` satisfies ParseKeys)}
                </span>
              ))}
              <AbmeldeKnopf />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
