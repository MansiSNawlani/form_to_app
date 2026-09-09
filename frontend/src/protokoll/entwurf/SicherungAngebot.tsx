import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { gleicheAntworten, sicherungsStore, type Sicherung } from './sicherung'
import type { Antworten, Entwurf } from './typen'

interface SicherungAngebotProps {
  entwurf: Entwurf
  form: UseFormReturn<Antworten>
  jetztSpeichern: () => void
}

/* The offer to put back what a failed save left behind.
 *
 * Deliberately an offer and not an automatic restore. A copy is only ever
 * written for a save the server did not confirm, so it usually is the newer
 * document, but "usually" is not good enough to overwrite survey data with:
 * the same protocol may have been carried on and saved somewhere else since,
 * and applying the copy silently would undo that with nothing on screen to say
 * so. Merging the two is not on the table either, because which answer wins
 * is a rule FFS has not given us. So the person is shown both facts and asked.
 *
 * A copy that matches what the server returned is thrown away without a word.
 * It landed after all, most likely from another tab, and there is nothing to
 * decide.
 */
function SicherungAngebot({ entwurf, form, jetztSpeichern }: SicherungAngebotProps) {
  const { t, i18n } = useTranslation()

  /* Read once, as this component mounts, rather than in an effect. Storage
     answers synchronously, so there is nothing to wait for, and setting state
     from an effect would render the page once without the offer and again with
     it. ProtokollFormular is keyed by the protocol id, so opening a different
     one remounts this and reads afresh. */
  const [sicherung, setSicherung] = useState<Sicherung | null>(() => {
    const gefunden = sicherungsStore.lies(entwurf.id)
    if (gefunden === null) return null
    return gleicheAntworten(gefunden.antworten, entwurf.antworten) ? null : gefunden
  })

  /* Throwing away a copy that says nothing new is a change to the world outside
     React, so it belongs here rather than in the initialiser above, which React
     may run more than once. */
  useEffect(() => {
    const gefunden = sicherungsStore.lies(entwurf.id)
    if (gefunden !== null && gleicheAntworten(gefunden.antworten, entwurf.antworten)) {
      sicherungsStore.loesche(entwurf.id)
    }
  }, [entwurf.id, entwurf.antworten])

  if (sicherung === null) return null

  function uebernehmen() {
    if (sicherung === null) return
    /* reset rather than a run of setValue, so the fields the copy does not
       mention go back to being untouched instead of keeping whatever the server
       sent. The copy is a whole document, and this puts the whole document
       back. */
    form.reset(sicherung.antworten)
    sicherungsStore.loesche(entwurf.id)
    setSicherung(null)
    // Straight away rather than at the end of a debounce nothing will start:
    // reset is not typing, and the point of taking the offer is to have these
    // answers on the server.
    jetztSpeichern()
  }

  function verwerfen() {
    sicherungsStore.loesche(entwurf.id)
    setSicherung(null)
  }

  const gehalten = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(sicherung.zeitpunkt))

  return (
    <Alert severity="warning" className="protokoll-sicherung">
      <AlertTitle>{t('protokoll.sicherung.titel')}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t('protokoll.sicherung.text', { zeitpunkt: gehalten })}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" size="small" onClick={uebernehmen}>
          {t('protokoll.sicherung.uebernehmen')}
        </Button>
        <Button variant="outlined" size="small" onClick={verwerfen}>
          {t('protokoll.sicherung.verwerfen')}
        </Button>
      </Stack>
    </Alert>
  )
}

export default SicherungAngebot
