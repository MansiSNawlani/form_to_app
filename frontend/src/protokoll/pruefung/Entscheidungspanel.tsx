import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BestaetigungsDialog from '../../components/BestaetigungsDialog'
import { fehlertext } from '../../api/fehler'
import { ENTSCHEIDUNGEN, brauchtBegruendung, istEndgueltig } from './entscheidungen'
import { entscheidungsfehler } from './entscheidungsfehler'
import type { Entscheidung } from './typen'
import { useEntscheiden, useInPruefungNehmen, useProtokollAktualisieren } from './useUebergang'

interface EntscheidungspanelProps {
  entwurfId: string
  /* Whether this protocol can still be picked up. False once it is IN_REVIEW,
     which is the only state In Pruefung nehmen leads to. */
  kannAufnehmen: boolean
}

const BEGRUENDUNG_ID = 'entscheidung-begruendung'
const BEGRUENDUNG_HINWEIS_ID = `${BEGRUENDUNG_ID}-hinweis`
const BEGRUENDUNG_FEHLER_ID = `${BEGRUENDUNG_ID}-fehler`

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
  const aufnehmen = useInPruefungNehmen(entwurfId)
  const entscheiden = useEntscheiden(entwurfId)
  const aktualisieren = useProtokollAktualisieren(entwurfId)

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

  function speichern() {
    setFehlt(null)
    /* The server's last answer goes too, not only ours. A refusal left standing
       over a panel somebody has just repaired reads as though the repair did not
       take. */
    entscheiden.reset()

    if (entscheidung === null) {
      setFehlt('protokoll.entscheidung.fehlt.entscheidung')
      return
    }

    /* Trimmed, and absent rather than empty when nothing was written: the API's
       kommentar is optional, and an empty string is a reason somebody gave
       rather than one they left out. */
    const text = begruendung.trim()
    if (text === '' && brauchtBegruendung(entscheidung)) {
      setFehlt('protokoll.entscheidung.fehlt.begruendung')
      return
    }

    /* Annehmen locks the protocol and Ablehnen ends it, and nothing leaves
       either state. Aenderung anfordern is the reversible one and goes straight
       through: asking about it would train people to click past the dialog that
       matters. */
    if (istEndgueltig(entscheidung)) {
      setZuBestaetigen(entscheidung)
      return
    }

    absenden(entscheidung)
  }

  function absenden(wahl: Entscheidung) {
    setZuBestaetigen(null)

    const text = begruendung.trim()
    entscheiden.mutate({ entscheidung: wahl, kommentar: text === '' ? undefined : text })
  }

  /* Where the server's refusal belongs, if there is one. The missing Begruendung
     lands in the same place our own check puts it, so one refusal has one home on
     screen whichever half of the application noticed it. */
  const stelle = entscheiden.isError ? entscheidungsfehler(entscheiden.error) : null

  const begruendungFehlt =
    fehlt === 'protokoll.entscheidung.fehlt.begruendung' || stelle === 'begruendung'

  return (
    <section className="card">
      <h2 className="panel__head">{t('protokoll.entscheidung.titel')}</h2>
      <div className="panel__body">
        {kannAufnehmen && (
          <div className="entscheidung__aufnehmen">
            <Typography variant="body2" className="hinweis__text">
              {t('protokoll.entscheidung.aufnehmenHinweis')}
            </Typography>
            <Button
              variant="outlined"
              /* Disabled while the call is in flight. A second press would be
                 refused as a transition that is no longer possible, and a
                 refusal for something that in fact worked reads as a fault. */
              disabled={aufnehmen.isPending}
              onClick={() => {
                aufnehmen.mutate()
              }}
            >
              {aufnehmen.isPending
                ? t('protokoll.entscheidung.aufnehmenLaeuft')
                : t('protokoll.entscheidung.aufnehmen')}
            </Button>
          </div>
        )}

        <FormControl
          component="fieldset"
          fullWidth
          error={fehlt === 'protokoll.entscheidung.fehlt.entscheidung'}
        >
          {/* FormLabel above the group rather than InputLabel, the same rule
              every field on the form follows. It asks the question rather than
              repeating the panel's own title, which would name the group twice
              and say nothing the second time. */}
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
                    <strong>{t(`protokoll.entscheidung.wahl.${wahl}.titel` as ParseKeys)}</strong>
                    <span>{t(`protokoll.entscheidung.wahl.${wahl}.text` as ParseKeys)}</span>
                  </>
                }
              />
            ))}
          </RadioGroup>
          {fehlt === 'protokoll.entscheidung.fehlt.entscheidung' && (
            <FormHelperText className="field__error" role="alert">
              {t(fehlt)}
            </FormHelperText>
          )}
        </FormControl>

        <FormControl fullWidth error={begruendungFehlt} className="entscheidung__begruendung">
          <FormLabel htmlFor={BEGRUENDUNG_ID}>
            {t('protokoll.entscheidung.begruendung')}
          </FormLabel>
          <TextField
            id={BEGRUENDUNG_ID}
            multiline
            rows={5}
            value={begruendung}
            onChange={(ereignis) => {
              setBegruendung(ereignis.target.value)
            }}
            aria-describedby={
              begruendungFehlt
                ? `${BEGRUENDUNG_HINWEIS_ID} ${BEGRUENDUNG_FEHLER_ID}`
                : BEGRUENDUNG_HINWEIS_ID
            }
          />
          <FormHelperText id={BEGRUENDUNG_HINWEIS_ID} error={false}>
            {t('protokoll.entscheidung.begruendungHinweis')}
          </FormHelperText>
          {/* Beside the box, never at the top of the page: this is the one
              refusal in the workflow a reviewer puts right by typing. */}
          {begruendungFehlt && (
            <FormHelperText className="field__error" id={BEGRUENDUNG_FEHLER_ID} role="alert">
              {t('protokoll.entscheidung.fehlt.begruendung')}
            </FormHelperText>
          )}
        </FormControl>

        {/* Somebody else decided first, or this page has been open since
            yesterday. Nothing was typed wrong and pressing again cannot help, so
            the way out is the current state rather than a retry. */}
        {stelle === 'veraltet' && (
          <div className="entscheidung__fehler" role="alert">
            <Typography variant="body2" className="hinweis__text">
              {t('protokoll.entscheidung.veraltet')}
            </Typography>
            <Button size="small" variant="outlined" onClick={aktualisieren}>
              {t('protokoll.entscheidung.neuLaden')}
            </Button>
          </div>
        )}

        {stelle === 'sonst' && (
          <Typography variant="body2" className="entscheidung__fehler" role="alert">
            <Fehlersatz fehler={entscheiden.error} />
          </Typography>
        )}

        <div className="entscheidung__aktionen">
          <Button variant="contained" disabled={entscheiden.isPending} onClick={speichern}>
            {entscheiden.isPending
              ? t('protokoll.entscheidung.speichernLaeuft')
              : t('protokoll.entscheidung.speichern')}
          </Button>
        </div>
      </div>

      {/* Cancelling leaves the chosen decision chosen and the Begruendung typed,
          because the question is whether to go through with it, not whether it
          was meant at all. */}
      <BestaetigungsDialog
        offen={zuBestaetigen !== null}
        titel={zuBestaetigen === null ? '' : t(bestaetigung(zuBestaetigen, 'titel'))}
        text={zuBestaetigen === null ? '' : t(bestaetigung(zuBestaetigen, 'text'))}
        abbrechenLabel={t('protokoll.entscheidung.bestaetigen.abbrechen')}
        bestaetigenLabel={
          zuBestaetigen === null
            ? ''
            : t(`protokoll.entscheidung.wahl.${zuBestaetigen}.titel` as ParseKeys)
        }
        onAbbrechen={() => {
          setZuBestaetigen(null)
        }}
        onBestaetigen={() => {
          if (zuBestaetigen !== null) absenden(zuBestaetigen)
        }}
      />
    </section>
  )
}

/* The two keys a confirmation needs. Only the final decisions have them, which
   is why this is a lookup rather than a key per decision in the markup. */
function bestaetigung(entscheidung: Entscheidung, teil: 'titel' | 'text'): ParseKeys {
  return `protokoll.entscheidung.bestaetigen.${entscheidung}.${teil}` as ParseKeys
}

/* The backend's own sentence, or ours where we have one. fehlertext hands back a
   key or finished German, never both, so the component is the only thing here
   that translates. */
function Fehlersatz({ fehler }: { fehler: unknown }) {
  const { t } = useTranslation()
  const text = fehlertext(fehler)

  return <>{text.art === 'schluessel' ? t(text.schluessel) : text.text}</>
}

export default Entscheidungspanel
