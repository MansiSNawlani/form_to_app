const legalLinks = [
  'Impressum',
  'Datenschutz',
  'Barrierefreiheit',
  'Hilfe',
  'Kontakt',
]

/* Strings are hard-coded German here on purpose; sub-feature 1b moves them into
   a locale file. The form version is likewise fixed until a submission supplies
   its own, per the FormVersion model in project-overview.md. */
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span>Fischereiforschungsstelle Baden-Württemberg</span>
        <nav aria-label="Rechtliches">
          {legalLinks.map((label) => (
            <a key={label} className="shell-link" href={`/${label.toLowerCase()}`}>
              {label}
            </a>
          ))}
        </nav>
        <span className="site-footer__version">Formularversion 20260609</span>
      </div>
    </footer>
  )
}

export default SiteFooter
