import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import { istNeu } from '../entwurf/neu'
import { protokollTitel } from '../entwurf/titel'
import type { Antworten } from '../entwurf/typen'

interface AbsendenBlockProps {
  entwurfId: string
  absenden: () => void
  laeuft: boolean
}

/* The end of the protocol: the button that sends it.
 *
 * At the foot of section 7 rather than in the header, decided with the user on
 * 2026-09-11. Sections can be filled in in any order, so a header button would
 * be reachable from all seven; but it would also sit permanently beside a
 * half-finished draft inviting a press that is mostly going to be refused. The
 * end of the last section is where finishing something reads as finishing it,
 * and it is where the paper form ends too.
 *
 * **What comes back is drawn above the section, not here.** The panel listing
 * what is still missing is full of links to other sections, so it has to outlive
 * the trip it invites; it lives in ProtokollFormular beside the save indicator
 * for that reason. This component owns only the action.
 *
 * Asks first. Submitting cannot be taken back by the person who did it: from
 * here on the protocol is a record somebody else is working with, and the way
 * back is a reviewer asking for changes.
 */
function AbsendenBlock({ entwurfId, absenden, laeuft }: AbsendenBlockProps) {
  const { t } = useTranslation()
  const [fragt, setFragt] = useState(false)
  /* getValues, not watch. watch() with no argument subscribes this component to
     every field in the document, and coding-standards.md chose React Hook Form
     precisely so that a keystroke does not re-render the form around it. The name
     is read when the dialog opens, which re-renders this component anyway. */
  const { getValues } = useFormContext<Antworten>()

  /* A protocol with no record behind it is empty by definition, since the first
     thing typed is what creates one. Sending it could only be refused, and it
     would leave an empty protocol on the server to be refused again. */
  const nochLeer = istNeu(entwurfId)

  /* The protocol's own name, so the question names the thing rather than asking
     about "this protocol". A draft may not have one yet, which is what the
     second wording is for. */
  const name = protokollTitel(getValues())

  return (
    <fieldset className="form-section">
      <legend>{t('protokoll.absenden.legend')}</legend>
      <p className="form-section__hint">{t('protokoll.absenden.hinweis')}</p>

      {nochLeer && <Alert severity="info">{t('protokoll.absenden.nochNichtAngelegt')}</Alert>}

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

export default AbsendenBlock
