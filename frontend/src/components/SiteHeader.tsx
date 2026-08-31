import ThemeToggle from './ThemeToggle'

/* Strings are hard-coded German here on purpose. Sub-feature 1b moves every one
   of them into a locale file; doing both at once makes the diff unreadable. */
function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            BW
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
          {/* Placeholder identity. Feature 2 replaces this with the signed-in user. */}
          <span>
            <strong>M. Bergmann</strong>{' '}
            <span className="role-tag">Einreicher</span>
          </span>
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
