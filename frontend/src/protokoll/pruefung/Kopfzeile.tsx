import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { darfPruefen } from '../../auth/startseite'
import { useSitzung } from '../../auth/useSitzung'
import Statusabzeichen from '../Statusabzeichen'
import { protokollTitel } from '../entwurf/titel'
import { datumAnzeige } from '../liste/anzeige'
import { abfrageAus } from '../pruefliste/parameter'
import { prueflistenPfad } from '../pruefliste/pfad'
import Listennavigation from './Listennavigation'
import type { Entwurf } from '../entwurf/typen'

/* What is being read, what state it is in, and where in the queue it sits.
 *
 * Deliberately not ProtokollTitel, which is the form's heading. That one reads
 * the water and the place through useWatch so the title follows what is being
 * typed, and it needs a React Hook Form context to do it. Nothing here is being
 * typed, and this head is drawn before the form provider exists, so it takes the
 * same two answers straight out of the document through the shared
 * protokollTitel. The rule for what a protocol is called lives in one place
 * either way.
 *
 * **The crumb is drawn for the accounts that see the Pruefliste link in the
 * header, and it is not a permission.** darfPruefen answers that question once
 * for the whole browser; the endpoint refuses everybody else whether or not a
 * link was drawn. What it saves is offering a surveyor reading back their own
 * filed protocol a way into a queue that is not theirs, and asking the server a
 * question it would certainly refuse. They keep the Alle Protokolle button,
 * which goes where they actually came from.
 *
 * **Which queue it goes back to comes out of the address bar**, put there by the
 * Pruefen button that opened this screen. This page has no list of its own, so
 * without that the crumb could only guess, and a reviewer who had narrowed the
 * queue to one water would be dropped back into all of it.
 */
function Kopfzeile({ protokoll }: { protokoll: Entwurf }) {
  const { t } = useTranslation()
  const sitzung = useSitzung()
  const [suchparameter] = useSearchParams()

  const titel = protokollTitel(protokoll.antworten)
  const datum = datumAnzeige(protokoll.antworten.datum ?? null)

  const ausDerPruefliste =
    sitzung.zustand === 'angemeldet' && darfPruefen(sitzung.benutzer.rollen)
  /* Read once here and handed to both, so the crumb and the two step buttons
     cannot end up describing two different lists. */
  const abfrage = abfrageAus(suchparameter)

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
          {ausDerPruefliste && (
            <>
              <Link
                component={RouterLink}
                to={prueflistenPfad(abfrage)}
                className="krume"
              >
                {t('shell.nav.pruefliste')}
              </Link>
              <span className="krume-trenner">{' › '}</span>
            </>
          )}
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
        {ausDerPruefliste && <Listennavigation id={protokoll.id} abfrage={abfrage} />}
        {/* The crumb is this reader's way back, so a second one beside it would
            be two links to two different lists. Everybody else keeps theirs. */}
        {!ausDerPruefliste && (
          <Button component={RouterLink} to="/" size="small" variant="outlined">
            {t('protokoll.kopf.alleProtokolle')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default Kopfzeile
