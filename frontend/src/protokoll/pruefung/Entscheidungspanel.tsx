import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import OutlinedInput from '@mui/material/OutlinedInput'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import Aufnahmeblock from './Aufnahmeblock'
import Panel from './Panel'
import Uebergangsfehler from './Uebergangsfehler'
import { ENTSCHEIDUNGEN, brauchtBegruendung, istEndgueltig } from './entscheidungen'
import { entscheidungsfehler } from './entscheidungsfehler'
import type { Entscheidung } from './typen'
import { useEntscheiden } from './useUebergang'

interface EntscheidungspanelProps {
  entwurfId: string
  /* Whether this protocol can still be picked up. False once it is IN_REVIEW,
     which is the only state In Pruefung nehmen leads to. */
  kannAufnehmen: boolean
}

const BEGRUENDUNG_ID = 'entscheidung-begruendung'
const HINWEIS_ID = `${BEGRUENDUNG_ID}-hinweis`
const FEHLER_ID = `${BEGRUENDUNG_ID}-fehler`

const FEHLT_ENTSCHEIDUNG = 'protokoll.entscheidung.fehlt.entscheidung' satisfies ParseKeys
const FEHLT_BEGRUENDUNG = 'protokoll.entscheidung.fehlt.begruendung' satisfies ParseKeys

/* What a reviewer can do about the protocol beside it.
 *
 * Built against the Entscheidung panel in prototypes/pruefung-protokoll.html.
 * Drawn only where entscheidungen.ts says so, which is not a permission: the
 * server refuses every one of these again, and this only decides what is worth
 * putting on screen.
 *
 * **Nothing is preselected.** The mockup shows Aenderung anfordern already
 * chosen; a decision nobody made must not be sitting ready under a button that
 * sends a protocol back to its author.
 */
function Entscheidungspanel({ entwurfId, kannAufnehmen }: EntscheidungspanelProps) {
  const { t } = useTranslation()
  const entscheiden = useEntscheiden(entwurfId)

  const [entscheidung, setEntscheidung] = useState<Entscheidung | null>(null)
  const [begruendung, setBegruendung] = useState('')
  /* What is wrong with what has been filled in, as a key. Cleared at the start
     of the next attempt rather than at the end of this one, so a message never
     sits over a panel somebody has just put right. */
  const [fehlt, setFehlt] = useState<ParseKeys | null>(null)
  /* The decision waiting to be confirmed, and nothing else. Not a boolean beside
     the chosen decision: two pieces of state for one fact drift apart, and the
     one that would drift here decides which irreversible thing happens. */
  const [zuBestaetigen, setZuBestaetigen] = useState<Entscheidung | null>(null)

  /* Trimmed, and absent rather than empty when nothing was written: the API's
     kommentar is optional, and an empty string is a reason somebody gave rather
     than one they left out. */
  const text = begruendung.trim()

  function speichern() {
    setFehlt(null)
    /* The server's last answer goes too, not only ours. A refusal left standing
       over a panel somebody has just repaired reads as though the repair did not
       take. */
    entscheiden.reset()

    if (entscheidung === null) {
      setFehlt(FEHLT_ENTSCHEIDUNG)
      return
    }

    if (text === '' && brauchtBegruendung(entscheidung)) {
      setFehlt(FEHLT_BEGRUENDUNG)
      return
    }

    /* Annehmen locks the protocol and Ablehnen ends it, and nothing leaves
       either state. Aenderung anfordern goes straight through: asking about the
       reversible one would train people to click past the dialog that matters. */
    if (istEndgueltig(entscheidung)) {
      setZuBestaetigen(entscheidung)
      return
    }

    absenden(entscheidung)
  }

  function absenden(wahl: Entscheidung) {
    setZuBestaetigen(null)
    entscheiden.mutate({ entscheidung: wahl, kommentar: text === '' ? undefined : text })
  }

  /* One refusal, one home on screen: a missing Begruendung lands beside the box
     whichever half of the application noticed it, ours before the call or the
     server's after it. */
  const begruendungFehlt =
    fehlt === FEHLT_BEGRUENDUNG ||
    (entscheiden.isError && entscheidungsfehler(entscheiden.error) === 'begruendung')

  return (
    <Panel titel={t('protokoll.entscheidung.titel')}>
      {kannAufnehmen && <Aufnahmeblock entwurfId={entwurfId} />}

      <FormControl component="fieldset" fullWidth error={fehlt === FEHLT_ENTSCHEIDUNG}>
        {/* FormLabel above the group rather than InputLabel, the same rule every
            field on the form follows. It asks the question rather than repeating
            the panel's own title, which would name the group twice and say
            nothing the second time. */}
        <FormLabel component="legend">{t('protokoll.entscheidung.frage')}</FormLabel>
        <RadioGroup
          className="decision"
          value={entscheidung ?? ''}
          onChange={(_ereignis, wert) => {
            setEntscheidung(wert as Entscheidung)
          }}
        >
          {ENTSCHEIDUNGEN.map((wahl) => (
            <FormControlLabel
              key={wahl}
              value={wahl}
              control={<Radio />}
              label={
                <>
                  <strong>{t(wahlKey(wahl, 'titel'))}</strong>
                  <span>{t(wahlKey(wahl, 'text'))}</span>
                </>
              }
            />
          ))}
        </RadioGroup>
        {fehlt === FEHLT_ENTSCHEIDUNG && (
          <FormHelperText className="field__error" role="alert">
            {t(FEHLT_ENTSCHEIDUNG)}
          </FormHelperText>
        )}
      </FormControl>

      <FormControl fullWidth error={begruendungFehlt} className="entscheidung__begruendung">
        <FormLabel htmlFor={BEGRUENDUNG_ID}>{t('protokoll.entscheidung.begruendung')}</FormLabel>
        {/* OutlinedInput rather than TextField, for the reason FeldText gives:
            TextField brings a FormControl and a label of its own, and nesting
            those inside the one above would break the label association this
            field depends on. Same MUI input, without a wrapper we already have. */}
        <OutlinedInput
          id={BEGRUENDUNG_ID}
          multiline
          minRows={5}
          fullWidth
          value={begruendung}
          onChange={(ereignis) => {
            setBegruendung(ereignis.target.value)
          }}
          /* On the textarea itself, through inputProps: anything handed to
             OutlinedInput directly lands on the wrapper and names nothing. */
          inputProps={{
            'aria-invalid': begruendungFehlt ? true : undefined,
            'aria-describedby': begruendungFehlt ? `${HINWEIS_ID} ${FEHLER_ID}` : HINWEIS_ID,
          }}
        />
        <FormHelperText id={HINWEIS_ID} error={false}>
          {t('protokoll.entscheidung.begruendungHinweis')}
        </FormHelperText>
        {/* Beside the box, never at the top of the panel: this is the one
            refusal in the workflow a reviewer puts right by typing. */}
        {begruendungFehlt && (
          <FormHelperText className="field__error" id={FEHLER_ID} role="alert">
            {t(FEHLT_BEGRUENDUNG)}
          </FormHelperText>
        )}
      </FormControl>

      {entscheiden.isError && <Uebergangsfehler entwurfId={entwurfId} fehler={entscheiden.error} />}

      <div className="entscheidung__aktionen">
        <Button variant="contained" disabled={entscheiden.isPending} onClick={speichern}>
          {entscheiden.isPending
            ? t('protokoll.entscheidung.speichernLaeuft')
            : t('protokoll.entscheidung.speichern')}
        </Button>
      </div>

      {/* Cancelling leaves the chosen decision chosen and the Begruendung typed,
          because the question is whether to go through with it, not whether it
          was meant at all. */}
      <BestaetigungsDialog
        offen={zuBestaetigen !== null}
        titel={zuBestaetigen === null ? '' : t(bestaetigungsKey(zuBestaetigen, 'titel'))}
        text={zuBestaetigen === null ? '' : t(bestaetigungsKey(zuBestaetigen, 'text'))}
        abbrechenLabel={t('protokoll.entscheidung.bestaetigen.abbrechen')}
        bestaetigenLabel={zuBestaetigen === null ? '' : t(wahlKey(zuBestaetigen, 'titel'))}
        laeuft={entscheiden.isPending}
        onAbbrechen={() => {
          setZuBestaetigen(null)
        }}
        onBestaetigen={() => {
          if (zuBestaetigen !== null) absenden(zuBestaetigen)
        }}
      />
    </Panel>
  )
}

function wahlKey(entscheidung: Entscheidung, teil: 'titel' | 'text'): ParseKeys {
  return `protokoll.entscheidung.wahl.${entscheidung}.${teil}` as ParseKeys
}

/* Only the two final decisions have these, which is why the confirmation reads
   them through a function rather than naming a key per decision in the markup. */
function bestaetigungsKey(entscheidung: Entscheidung, teil: 'titel' | 'text'): ParseKeys {
  return `protokoll.entscheidung.bestaetigen.${entscheidung}.${teil}` as ParseKeys
}

export default Entscheidungspanel
