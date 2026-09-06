import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useMemo } from 'react'
import { get, useFormState } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ARTNUMMERN, ZEILENSPALTEN, alleArtPfade, artPfad } from './tabelle'
import type { Antworten, AntwortPfad, Artnummer } from '../../entwurf/typen'

/* What is wrong in the individual cells of the catch table, written out under it.
 *
 * Every other section shows a field's message under the field, drawn by
 * FeldRahmen. A table cell has no frame: it is about sixty pixels wide and named
 * by the column heading a sighted user reads across to, so there is nowhere in it
 * for a sentence to go. 9a wired both cell components to point aria-describedby
 * at `${pfad}-fehler` and left the id unclaimed; this is what claims it.
 *
 * A wrong cell is therefore marked two ways: it carries the error look and
 * aria-invalid, which is what finds it among 312, and its message is written here
 * with the row and column that identify it.
 *
 * Not a live region, deliberately. teil5/PaarMeldung.tsx is one because it is a
 * single sentence about two boxes; this list can hold twenty-six entries and
 * changes whenever any cell is left, so announcing it would read a paragraph at a
 * time over somebody trying to type. A screen reader user gets the message for
 * the cell they are in, through the aria-describedby this component makes
 * resolve. A read-out of everything at once belongs to feature 11's submit gate,
 * where it is a summary somebody asked for.
 *
 * It reads formState.errors rather than calling the rules, unlike its neighbour
 * NachweisMeldung. These are real field paths, so React Hook Form refreshes them
 * per field and the onTouched cadence comes free.
 *
 * The subscription is 312 paths, and that is acceptable for the same reason
 * Gesamtsumme's 260 are: this is a leaf, so a cell being left re-renders this
 * list and no cell at all.
 */

interface Zellmeldung {
  pfad: AntwortPfad
  nr: Artnummer
  spalteKey: ParseKeys
  schluessel: ParseKeys
}

const TITEL_ID = 'arten-meldungen-titel'

function Zellmeldungen() {
  const { t } = useTranslation()

  /* Memoised because useFormState resubscribes when the name array changes
     identity, and at 312 paths a fresh array per render would resubscribe the
     widest watch in the section. */
  const pfade = useMemo(() => alleArtPfade(), [])

  const { errors } = useFormState<Antworten>({ name: pfade })

  const meldungen = useMemo(() => zellmeldungen(errors), [errors])

  if (meldungen.length === 0) return null

  return (
    <div className="tabelle-meldungen">
      <Typography id={TITEL_ID} className="tabelle-meldungen__titel">
        {t('protokoll.abschnitt6.meldung.legend')}
      </Typography>
      {/* Named by the line above rather than by a heading, because the section
          already has one and the list is not a new part of the document. */}
      <List
        dense
        disablePadding
        aria-labelledby={TITEL_ID}
        className="tabelle-meldungen__liste"
      >
        {meldungen.map(({ pfad, nr, spalteKey, schluessel }) => (
          <ListItem key={pfad} disableGutters disablePadding>
            {/* The place sits outside the described element on purpose. The cell
                already announces itself as "Art 3, ueber 10 bis 15 cm", so a
                description covering that too would say it twice to the one person
                who cannot see which cell is red. */}
            <span className="tabelle-meldungen__ort">
              {t('protokoll.abschnitt6.meldung.zelle', { nr, spalte: t(spalteKey) })}
            </span>{' '}
            <span id={`${pfad}-fehler`}>{t(schluessel)}</span>
          </ListItem>
        ))}
      </List>
    </div>
  )
}

/* The error tree flattened back into the table's own order, so the list reads
   down the page the way the rows do rather than in whatever order the rules ran.

   get is React Hook Form's own path reader, the one register and the draft store
   already go through, so "arten.art1.0plus" resolves exactly as it does
   everywhere else. That matters for this one path: 0plus is the only field name
   on the protocol beginning with a digit. */
function zellmeldungen(errors: unknown): Zellmeldung[] {
  return ARTNUMMERN.flatMap((nr) =>
    ZEILENSPALTEN.flatMap(({ feld, nameKey }) => {
      const pfad = artPfad(nr, feld)
      const schluessel = get(errors, `${pfad}.message`) as ParseKeys | undefined

      return schluessel ? [{ pfad, nr, spalteKey: nameKey, schluessel }] : []
    }),
  )
}

export default Zellmeldungen
