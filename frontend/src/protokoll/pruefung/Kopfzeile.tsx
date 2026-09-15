import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Statusabzeichen from '../Statusabzeichen'
import { protokollTitel } from '../entwurf/titel'
import { datumAnzeige } from '../liste/anzeige'
import type { Entwurf } from '../entwurf/typen'

/* What is being read, and what state it is in.
 *
 * Deliberately not ProtokollTitel, which is the form's heading. That one reads
 * the water and the place through useWatch so the title follows what is being
 * typed, and it needs a React Hook Form context to do it. Nothing here is being
 * typed, and this head is drawn before the form provider exists, so it takes the
 * same two answers straight out of the document through the shared
 * protokollTitel. The rule for what a protocol is called lives in one place
 * either way.
 *
 * The mockup also heads the page with a "Pruefliste" crumb and Vorheriges and
 * Naechstes buttons. All three move through the review queue, which is feature
 * 12, so they are left out rather than built as links with nowhere to go.
 */
function Kopfzeile({ protokoll }: { protokoll: Entwurf }) {
  const { t } = useTranslation()

  const titel = protokollTitel(protokoll.antworten)
  const datum = datumAnzeige(protokoll.antworten.datum ?? null)

  return (
    <div className="page__head">
      <div>
        <Typography variant="h1">
          {titel ?? t('protokoll.kopf.titelPlatzhalter')}
        </Typography>
        {/* The survey date, not the day it was filed. A reviewer asking "which
            outing was this" means the day somebody stood in the water. The date
            it was handed in is in the summary bar below, labelled as such.

            Left out entirely when the stored date will not parse, rather than
            printing "Protokoll vom" with a hole after it. A protocol is never
            migrated to a later form version (ADR 0004), so an unreadable value
            is something this screen survives rather than a bug to surface. */}
        <p className="page__sub">
          {datum !== null && (
            <>
              {t('protokoll.pruefung.protokollVom', { datum })}
              {' · '}
            </>
          )}
          {t('shell.footer.formVersion', { version: protokoll.form_version })}
        </p>
      </div>
      <div className="page__head-actions">
        <Statusabzeichen status={protokoll.status} />
        <Button component={Link} to="/" size="small" variant="outlined">
          {t('protokoll.kopf.alleProtokolle')}
        </Button>
      </div>
    </div>
  )
}

export default Kopfzeile
