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

/* No form version here, deliberately.
 *
 * This footer is on every screen, including the login page, so a version printed
 * in it claims to describe the whole application. It does not: it describes one
 * protocol. The portal is meant to carry several different forms in time, the
 * Protokoll Krebs among them, and each keeps its own frozen version under
 * ADR 0004.
 *
 * It is already shown where it means something, in ProtokollKopf, read from the
 * open draft's own formVersion rather than from a constant. The copy that used
 * to sit here was hard-coded, so it would also have gone stale on its own. */
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
      </div>
    </footer>
  )
}

export default SiteFooter
