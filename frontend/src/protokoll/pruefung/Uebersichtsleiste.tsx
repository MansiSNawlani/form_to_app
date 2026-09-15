import { useTranslation } from 'react-i18next'
import { anlassLabel, zeitpunktAnzeige } from '../liste/anzeige'
import { optionen } from '../optionen'
import { angezeigterWert } from '../nurlesen/wert'
import type { Entwurf } from '../entwurf/typen'

/* The label for a Regierungspraesidium number, out of the extracted list.
 *
 * The number rather than the label is what the envelope stores, because that is
 * what the legacy form exports and what FiaKa receives. The list is where the
 * wording lives, and it is read rather than retyped like every other option list
 * on this form.
 *
 * The mockup writes it "4 - Tuebingen". This prints the label the seed file
 * actually holds, which is "Regierungspraesidium Tuebingen", because splitting a
 * generated label into a number and a city would mean transforming generated
 * data on the way to the screen, and the next regeneration could change the
 * wording underneath it.
 *
 * An unknown number falls back to the number, the same way anlassLabel falls back
 * to its code, for the reason ADR 0004 gives: a protocol is never migrated to a
 * later form version, so a value this version's list no longer offers has to stay
 * readable.
 */
function regierungspraesidiumLabel(nummer: number | null): string | null {
  if (nummer === null) return null

  const wert = String(nummer)
  return optionen('z.rp').find((option) => option.wert === wert)?.label ?? wert
}

interface EintragProps {
  titel: string
  wert: string | null
}

function Eintrag({ titel, wert }: EintragProps) {
  const { t } = useTranslation()

  return (
    <div>
      <dt>{titel}</dt>
      {/* The same placeholder the fields below use, so one page has one way of
          saying an answer is missing. None of these should be empty on a
          submitted protocol; printing nothing would make a gap look like a
          layout fault rather than like missing data. */}
      <dd>{angezeigterWert(wert) ?? t('protokoll.nurlesen.leer')}</dd>
    </div>
  )
}

/* The envelope, across the head of the protocol.
 *
 * The five facts prototypes/pruefung-protokoll.html puts here, and they are the
 * whole reason feature 11e widened the read response: none of them was on it,
 * because until feature 11d the only person who ever saw a protocol was the
 * person filling it in, who knows perfectly well whose it is.
 *
 * A definition list, because that is what a label and its value are. It wraps
 * rather than scrolling: five short facts are not a table.
 */
function Uebersichtsleiste({ protokoll }: { protokoll: Entwurf }) {
  const { t } = useTranslation()

  const eingereichtAm =
    protokoll.submitted_at === null ? null : zeitpunktAnzeige(protokoll.submitted_at)

  return (
    <dl className="summary-bar">
      <Eintrag
        titel={t('protokoll.pruefung.uebersicht.eingereichtVon')}
        wert={protokoll.eingereicht_von}
      />
      <Eintrag
        titel={t('protokoll.pruefung.uebersicht.bearbeiter')}
        wert={protokoll.bearbeiter_name}
      />
      <Eintrag
        titel={t('protokoll.pruefung.uebersicht.eingereichtAm')}
        wert={eingereichtAm}
      />
      <Eintrag
        titel={t('protokoll.pruefung.uebersicht.anlass')}
        wert={anlassLabel(protokoll.anlass)}
      />
      <Eintrag
        titel={t('protokoll.pruefung.uebersicht.regierungspraesidium')}
        wert={regierungspraesidiumLabel(protokoll.regierungspraesidium)}
      />
    </dl>
  )
}

export default Uebersichtsleiste
