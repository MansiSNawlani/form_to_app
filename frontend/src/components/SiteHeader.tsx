import ThemeToggle from './ThemeToggle'

/* Three strings here are deliberately NOT in the locale file and must never be
   translated:
     - "FFS" and the organisation name are proper nouns.
     - "Protokoll E-Befischung" is the name of the legacy form and a domain term,
       which coding-standards.md keeps German in every locale.
   Keeping them literal means feature 17's English pass cannot reach them by
   accident. */
function SiteHeader() {
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
          {/* The signed-in account goes here in the next step. Until then there
              is nothing: the sample name that stood here through features 1a to
              10 became a lie the moment a login page existed, because it told
              somebody who was not signed in that they were. */}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
