import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { angezeigterWert } from './wert'

interface FeldwertProps {
  /** What was answered. The caller has already turned a code into its label. */
  wert: string | null | undefined
  /** A unit printed after the value, such as the m after a stretch length. */
  einheit?: string
  /* Numbers line up in a column when they are all the same width, which matters
     wherever several sit under one another: coordinates, counts, percentages. */
  ziffern?: boolean
}

/* One answer, printed rather than offered for editing.
 *
 * Deliberately **not a disabled input**. A greyed-out box still reads as a
 * control, and as one you have failed to be allowed to use; a reviewer is not
 * being denied the field, they are reading a record. prototypes/pruefung-protokoll.html
 * draws it as a bordered block of text and this follows it.
 *
 * It takes the text to print rather than the field's name, because what an
 * answer looks like as text is the calling component's knowledge and nothing
 * else's: a dropdown has to find its label in the option list, a checkbox has to
 * say Ja or Nein, and a date has to be made German. This end only decides
 * between something and nothing.
 *
 * The unit goes inside the block, as the mockup prints it, rather than beside it
 * the way the form's own .unit-row does. "110 m" is one value being read; the
 * form separates them because there the number is a control and the unit is not.
 */
function Feldwert({ wert, einheit, ziffern }: FeldwertProps) {
  const { t } = useTranslation()
  const text = angezeigterWert(wert)

  const klassen = ['readonly-value']
  if (ziffern) klassen.push('readonly-value--ziffern')
  if (text === null) klassen.push('readonly-value--leer')

  return (
    <Typography variant="body1" component="div" className={klassen.join(' ')}>
      {/* The placeholder is real text rather than a dash, so a screen reader
          says "nicht angegeben" instead of falling silent on the field or
          reading a punctuation mark. An empty field is a finding for a reviewer,
          not a gap to skip over. */}
      {text === null ? t('protokoll.nurlesen.leer') : einheit ? `${text} ${einheit}` : text}
    </Typography>
  )
}

export default Feldwert
