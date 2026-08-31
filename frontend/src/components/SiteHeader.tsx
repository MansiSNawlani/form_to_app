import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'

/* Three strings here are deliberately NOT in the locale file and must never be
   translated:
     - "FFS" and the organisation name are proper nouns.
     - "Protokoll E-Befischung" is the name of the legacy form and a domain term,
       which coding-standards.md keeps German in every locale.
   Keeping them literal means feature 17's English pass cannot reach them by
   accident. */
function SiteHeader() {
  const { t } = useTranslation()

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            FFS
          </span>
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
          {/* Placeholder identity, not a translatable string. The name is sample
              data and the role label comes from the locale file. Feature 2
              replaces both with the signed-in user. */}
          <span>
            <strong>M. Bergmann</strong>{' '}
            <span className="role-tag">{t('common.roles.submitter')}</span>
          </span>
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
