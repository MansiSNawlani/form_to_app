import type { ReactNode } from 'react'

/* One box in the reviewer's rail: a title strip, a rule, and a body.
 *
 * Three panels are drawn on this screen and every one of them is this shape, so
 * it is one component rather than three copies of the same three elements. The
 * heading level is fixed at h2 on purpose: the page head is the only h1, and a
 * panel that chose its own level would break the reading order for somebody
 * moving through the page by headings.
 */
function Panel({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="panel__head">{titel}</h2>
      <div className="panel__body">{children}</div>
    </section>
  )
}

export default Panel
