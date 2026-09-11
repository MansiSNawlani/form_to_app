import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import { useFehlertext } from '../../api/useFehlertext'
import { istNeu } from '../entwurf/neu'
import { protokollTitel } from '../entwurf/titel'
import type { Antworten } from '../entwurf/typen'
import AbsendeProbleme from './AbsendeProbleme'
import { NichtGespeichert, useAbsenden } from './useAbsenden'

interface AbsendenBlockProps {
  entwurfId: string
  bereitZumAbsenden: () => Promise<number | null>
}

/* The end of the protocol: the button that sends it, and what comes back.
 *
 * At the foot of section 7 rather than in the header, decided with the user on
 * 2026-09-11. Sections can be filled in in any order, so a header button would
 * be reachable from all seven; but it would also sit permanently beside a
 * half-finished draft inviting a press that is mostly going to be refused. The
 * end of the last section is where finishing something reads as finishing it,
 * and it is where the paper form ends too.
 *
 * Asks first. Submitting cannot be taken back by the person who did it: from
 * here on the protocol is a record somebody else is working with, and the way
 * back is a reviewer asking for changes.
 */
function AbsendenBlock({ entwurfId, bereitZumAbsenden }: AbsendenBlockProps) {
  const { t } = useTranslation()
  const [fragt, setFragt] = useState(false)
  /* getValues, not watch. watch() with no argument subscribes this component to
     every field in the document, and coding-standards.md chose React Hook Form
     precisely so that a keystroke does not re-render the form around it. Nothing
     here needs to track a change as it happens: the name and the species list
     are read when the dialog opens and when a refusal comes back, both of which
     re-render this component anyway. */
  const { getValues } = useFormContext<Antworten>()

  const { absenden, laeuft, verstoesse, fehler, bereitsAbgesendet } = useAbsenden({
    entwurfId,
    bereitZumAbsenden,
  })

  /* A protocol with no record behind it is empty by definition, since the first
     thing typed is what creates one. Sending it could only be refused, and it
     would leave an empty protocol on the server to be refused again. */
  const nochLeer = istNeu(entwurfId)

  /* The protocol's own name, so the question names the thing rather than asking
     about "this protocol". A draft may not have one yet, which is what the
     second wording is for. */
  const name = protokollTitel(getValues())

  const fehlertext = useFehlertext(fehler)
  const istUngespeichert = fehler instanceof NichtGespeichert

  /* The species standing in each catch row, so a refused cell in the table can
     be named by its fish rather than by its row number. Read only when there is
     something to name: watch() on the whole document is already how this
     component gets the protocol's title. */
  const artnamen = artnamenAus(getValues())

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.absenden.legend')}</legend>
      <p className="form-section__hint">{t('protokoll.absenden.hinweis')}</p>

      {nochLeer && <Alert severity="info">{t('protokoll.absenden.nochNichtAngelegt')}</Alert>}

      <AbsendeProbleme entwurfId={entwurfId} verstoesse={verstoesse} artnamen={artnamen} />

      {/* Pressed twice, or the first answer was lost on the way back. Nothing
          went wrong for the person, so this reads as good news with the way
          onward rather than as a conflict they have to do something about. */}
      {bereitsAbgesendet && (
        <Alert
          severity="success"
          action={
            <Button component={Link} to="/protokolle" size="small" color="inherit">
              {t('protokoll.absenden.bereitsAbgesendet.zurUebersicht')}
            </Button>
          }
        >
          {t('protokoll.absenden.bereitsAbgesendet.text')}
        </Alert>
      )}

      {fehler !== null && (
        <Alert severity="error">
          {istUngespeichert ? t('protokoll.absenden.nichtGespeichert') : fehlertext}
        </Alert>
      )}

      <div className="form-actions">
        <Button
          variant="contained"
          size="large"
          disabled={nochLeer || laeuft}
          onClick={() => setFragt(true)}
        >
          {laeuft ? t('protokoll.absenden.laeuft') : t('protokoll.absenden.aktion')}
        </Button>
      </div>

      <BestaetigungsDialog
        offen={fragt}
        titel={t('protokoll.absenden.frage.titel')}
        text={
          name === null
            ? t('protokoll.absenden.frage.textOhneNamen')
            : t('protokoll.absenden.frage.text', { name })
        }
        abbrechenLabel={t('protokoll.absenden.frage.abbrechen')}
        bestaetigenLabel={t('protokoll.absenden.frage.bestaetigen')}
        laeuft={laeuft}
        /* Not red. Submitting a finished protocol is the point of the whole
           application, not a hazard; the dialog exists because it cannot be
           undone, not because something is about to be destroyed. */
        bestaetigenFarbe="primary"
        onAbbrechen={() => setFragt(false)}
        onBestaetigen={() => {
          setFragt(false)
          absenden()
        }}
      />
    </fieldset>
  )
}

/* The species code in each catch row, keyed by row number.
 *
 * Only the code. Turning it into a German name is the panel's job, since that
 * needs the option list and this needs none of it.
 */
function artnamenAus(antworten: Antworten): Record<number, string | undefined> {
  const arten = antworten.arten
  if (arten === undefined) return {}

  const namen: Record<number, string | undefined> = {}
  for (const [schluessel, zeile] of Object.entries(arten)) {
    const nr = Number(schluessel.replace('art', ''))
    if (Number.isInteger(nr)) namen[nr] = zeile?.name
  }
  return namen
}

export default AbsendenBlock
