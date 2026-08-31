import { useTranslation } from 'react-i18next'

/* The legal links FFS require in the footer. Keyed rather than hard-coded so
   feature 17 can translate the labels, though whether Impressum and
   Barrierefreiheit translate at all is a question for FFS: both are German legal
   concepts rather than ordinary words. */
const LEGAL_LINKS = [
  'impressum',
  'datenschutz',
  'barrierefreiheit',
  'hilfe',
  'kontakt',
] as const

// Fixed until a submission supplies its own, per the FormVersion model in
// project-overview.md.
const FORM_VERSION = '20260609'

function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* Proper noun, deliberately not translated. See SiteHeader. */}
        <span>Fischereiforschungsstelle Baden-Württemberg</span>
        <nav aria-label={t('shell.footer.legalNavLabel')}>
          {LEGAL_LINKS.map((key) => (
            <a key={key} className="shell-link" href={`/${key}`}>
              {t(`shell.footer.${key}`)}
            </a>
          ))}
        </nav>
        <span className="site-footer__version">
          {t('shell.footer.formVersion', { version: FORM_VERSION })}
        </span>
      </div>
    </footer>
  )
}

export default SiteFooter
