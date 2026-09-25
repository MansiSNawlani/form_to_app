import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import lazbw from '../assets/lazbw.png'
import AbmeldeKnopf from '../auth/AbmeldeKnopf'
import { sortierteRollen } from '../auth/rollen'
import { BENUTZERVERWALTUNG, darfPruefen, darfVerwalten, PRUEFLISTE } from '../auth/startseite'
import { useSitzung } from '../auth/useSitzung'
import ThemeToggle from './ThemeToggle'

/* NavLink marks the page you are on itself, through aria-current, which is what a
   screen reader announces. The class only makes that visible to everybody else,
   so the two never disagree about which link is current. */
function navKlasse({ isActive }: { isActive: boolean }): string {
  return isActive ? 'site-header__navlink site-header__navlink--aktiv' : 'site-header__navlink'
}

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
        {/* Two lists, two questions, and a link between them. Meine Protokolle
            answers "what have I got"; the Pruefliste answers "what is waiting for
            FFS". Before feature 12b there was only one, so the shell needed no
            navigation at all.

            The Pruefliste is shown only to the three accounts the endpoint admits.
            That is a courtesy rather than a permission: hiding a link is not
            security, and the server refuses the page whether or not the link is
            drawn. Showing everybody a link that answers "this is not for you"
            would simply be a worse header. */}
        {sitzung.zustand === 'angemeldet' && (
          <nav className="site-header__nav" aria-label={t('shell.nav.beschriftung')}>
            <NavLink to="/" end className={navKlasse}>
              {t('shell.nav.meineProtokolle')}
            </NavLink>
            {darfPruefen(sitzung.benutzer.rollen) && (
              <NavLink to={PRUEFLISTE} className={navKlasse}>
                {t('shell.nav.pruefliste')}
              </NavLink>
            )}
            {/* Narrower again: the account list admits the Super Admin alone, so
                the link is drawn for them alone. Same courtesy, same non-promise
                as the Pruefliste link above it. */}
            {darfVerwalten(sitzung.benutzer.rollen) && (
              <NavLink to={BENUTZERVERWALTUNG} className={navKlasse}>
                {t('shell.nav.benutzerverwaltung')}
              </NavLink>
            )}
          </nav>
        )}

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
                  the same way round. Lifted into auth/rollen.ts in feature 16b,
                  when the account list became the second place that prints
                  somebody's roles and this stopped being the only caller. */}
              {sortierteRollen(sitzung.benutzer.rollen).map((rolle) => (
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
